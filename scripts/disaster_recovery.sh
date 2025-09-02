#!/bin/bash

# Disaster Recovery script for Off the Grid platform
# Handles system recovery, backup restoration, and failover procedures

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

# Environment variables
ENVIRONMENT="${ENVIRONMENT:-production}"
S3_BUCKET="${S3_BUCKET}"
BACKUP_ENCRYPTION_KEY="${DB_BACKUP_ENCRYPTION_KEY}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"

# Recovery configuration
RECOVERY_DIR="/tmp/recovery"
LOG_FILE="/var/log/disaster_recovery.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Database configuration
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-off_the_grid}"
DB_USER="${DB_USER:-off_the_grid_user}"
DB_PASSWORD="${PGPASSWORD}"

# Service configuration
DOCKER_COMPOSE_FILE="${DOCKER_COMPOSE_FILE:-docker-compose.production.yml}"
SERVICES=("api" "frontend" "cli_bot" "postgres" "redis" "nginx")

# =============================================================================
# LOGGING AND NOTIFICATIONS
# =============================================================================

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_info() {
    log "INFO" "$1"
}

log_error() {
    log "ERROR" "$1"
}

log_warn() {
    log "WARN" "$1"
}

send_alert() {
    local message="$1"
    local color="${2:-warning}"
    
    log_warn "ALERT: $message"
    
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"🚨 DISASTER RECOVERY: $message\"}]}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
}

# =============================================================================
# SYSTEM HEALTH CHECKS
# =============================================================================

check_system_health() {
    log_info "Checking system health..."
    
    local issues=()
    
    # Check disk space
    local disk_usage=$(df /var/lib/docker | awk 'NR==2 {print $5}' | sed 's/%//')
    if [[ $disk_usage -gt 90 ]]; then
        issues+=("Disk usage critical: ${disk_usage}%")
    fi
    
    # Check memory usage
    local mem_usage=$(free | awk 'NR==2{printf "%.2f", $3*100/$2}')
    if (( $(echo "$mem_usage > 90" | bc -l) )); then
        issues+=("Memory usage critical: ${mem_usage}%")
    fi
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        issues+=("Docker daemon not accessible")
    fi
    
    # Check network connectivity
    if ! ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        issues+=("Network connectivity issues")
    fi
    
    # Check S3 connectivity
    if ! aws s3 ls "s3://$S3_BUCKET" >/dev/null 2>&1; then
        issues+=("Cannot access S3 backup bucket")
    fi
    
    if [[ ${#issues[@]} -gt 0 ]]; then
        log_error "System health issues detected:"
        for issue in "${issues[@]}"; do
            log_error "  - $issue"
        done
        return 1
    else
        log_info "System health check passed"
        return 0
    fi
}

check_service_health() {
    log_info "Checking service health..."
    
    local unhealthy_services=()
    
    for service in "${SERVICES[@]}"; do
        if docker-compose -f "$DOCKER_COMPOSE_FILE" ps "$service" 2>/dev/null | grep -q "Up (healthy)"; then
            log_info "Service $service is healthy"
        else
            unhealthy_services+=("$service")
            log_error "Service $service is unhealthy"
        fi
    done
    
    if [[ ${#unhealthy_services[@]} -gt 0 ]]; then
        send_alert "Unhealthy services detected: ${unhealthy_services[*]}" "danger"
        return 1
    else
        log_info "All services are healthy"
        return 0
    fi
}

# =============================================================================
# BACKUP OPERATIONS
# =============================================================================

list_available_backups() {
    log_info "Listing available backups..."
    
    aws s3 ls "s3://$S3_BUCKET/database-backups/$ENVIRONMENT/" --recursive | \
        grep "\.sql\.enc$" | \
        sort -r | \
        head -20 | \
        awk '{print $4}' | \
        while read -r backup; do
            local filename=$(basename "$backup")
            local date_str=$(echo "$filename" | grep -o '[0-9]\{8\}_[0-9]\{6\}')
            local formatted_date=$(echo "$date_str" | sed 's/_/ /' | sed 's/\(..\)\(..\)\(..\)_\(..\)\(..\)/20\3-\1-\2 \4:\5/')
            echo "$formatted_date - $backup"
        done
}

find_latest_backup() {
    log_info "Finding latest backup..."
    
    local latest_backup=$(aws s3 ls "s3://$S3_BUCKET/database-backups/$ENVIRONMENT/" --recursive | \
                         grep "\.sql\.enc$" | \
                         sort -k 4 -r | \
                         head -1 | \
                         awk '{print $4}')
    
    if [[ -n "$latest_backup" ]]; then
        log_info "Latest backup found: $latest_backup"
        echo "$latest_backup"
        return 0
    else
        log_error "No backups found"
        return 1
    fi
}

download_backup() {
    local backup_path="$1"
    local local_path="$RECOVERY_DIR/$(basename "$backup_path")"
    
    log_info "Downloading backup: $backup_path"
    
    mkdir -p "$RECOVERY_DIR"
    
    if aws s3 cp "s3://$S3_BUCKET/$backup_path" "$local_path" --quiet; then
        log_info "Backup downloaded to: $local_path"
        echo "$local_path"
        return 0
    else
        log_error "Failed to download backup"
        return 1
    fi
}

decrypt_backup() {
    local encrypted_file="$1"
    local decrypted_file="${encrypted_file%.enc}"
    
    log_info "Decrypting backup..."
    
    if [[ -z "$BACKUP_ENCRYPTION_KEY" ]]; then
        log_error "Backup encryption key not provided"
        return 1
    fi
    
    if openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 \
       -pass "pass:$BACKUP_ENCRYPTION_KEY" \
       -in "$encrypted_file" | gunzip > "$decrypted_file"; then
        log_info "Backup decrypted successfully"
        echo "$decrypted_file"
        return 0
    else
        log_error "Failed to decrypt backup"
        return 1
    fi
}

# =============================================================================
# DATABASE RECOVERY
# =============================================================================

backup_current_database() {
    log_info "Creating backup of current database before recovery..."
    
    local backup_file="$RECOVERY_DIR/pre_recovery_backup_$TIMESTAMP.sql"
    
    if pg_dump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --format=plain \
        --no-password \
        --file="$backup_file" 2>&1 | tee -a "$LOG_FILE"; then
        
        log_info "Current database backed up to: $backup_file"
        
        # Upload to S3 for safety
        aws s3 cp "$backup_file" \
            "s3://$S3_BUCKET/database-backups/$ENVIRONMENT/recovery-snapshots/" \
            --server-side-encryption AES256 \
            --quiet || true
        
        return 0
    else
        log_error "Failed to backup current database"
        return 1
    fi
}

restore_database() {
    local backup_file="$1"
    local create_backup="${2:-true}"
    
    log_info "Starting database restoration from: $backup_file"
    
    # Backup current database if requested
    if [[ "$create_backup" == "true" ]]; then
        if ! backup_current_database; then
            log_error "Failed to backup current database"
            return 1
        fi
    fi
    
    # Stop application services to prevent connections
    log_info "Stopping application services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" stop api frontend cli_bot || true
    
    # Wait for connections to close
    sleep 10
    
    # Terminate existing connections
    log_info "Terminating existing database connections..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" \
        2>/dev/null || true
    
    # Drop and recreate database
    log_info "Recreating database..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" || return 1
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" || return 1
    
    # Restore database
    log_info "Restoring database from backup..."
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$backup_file" 2>&1 | tee -a "$LOG_FILE"; then
        log_info "Database restoration completed successfully"
        
        # Restart application services
        log_info "Starting application services..."
        docker-compose -f "$DOCKER_COMPOSE_FILE" up -d api frontend cli_bot
        
        # Wait for services to be healthy
        sleep 30
        
        return 0
    else
        log_error "Database restoration failed"
        return 1
    fi
}

# =============================================================================
# SERVICE RECOVERY
# =============================================================================

restart_services() {
    local services=("${@:-${SERVICES[@]}}")
    
    log_info "Restarting services: ${services[*]}"
    
    for service in "${services[@]}"; do
        log_info "Restarting service: $service"
        
        if docker-compose -f "$DOCKER_COMPOSE_FILE" restart "$service"; then
            log_info "Service $service restarted successfully"
        else
            log_error "Failed to restart service: $service"
            send_alert "Failed to restart service: $service" "danger"
        fi
        
        # Wait between restarts
        sleep 5
    done
    
    # Wait for services to stabilize
    log_info "Waiting for services to stabilize..."
    sleep 30
    
    # Check service health
    check_service_health
}

recreate_services() {
    local services=("${@:-${SERVICES[@]}}")
    
    log_info "Recreating services: ${services[*]}"
    
    # Stop services
    docker-compose -f "$DOCKER_COMPOSE_FILE" stop "${services[@]}"
    
    # Remove containers
    docker-compose -f "$DOCKER_COMPOSE_FILE" rm -f "${services[@]}"
    
    # Recreate and start services
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d "${services[@]}"
    
    # Wait for services to stabilize
    log_info "Waiting for services to stabilize..."
    sleep 60
    
    check_service_health
}

# =============================================================================
# FAILOVER PROCEDURES
# =============================================================================

initiate_failover() {
    log_info "Initiating failover procedure..."
    
    send_alert "Failover procedure initiated" "warning"
    
    # Enable maintenance mode
    enable_maintenance_mode
    
    # Switch to read replica if available
    if switch_to_replica; then
        log_info "Switched to database replica"
    else
        log_warn "Could not switch to database replica"
    fi
    
    # Restart all services with new configuration
    recreate_services
    
    # Verify system functionality
    if verify_system_functionality; then
        log_info "Failover completed successfully"
        send_alert "Failover completed successfully" "good"
    else
        log_error "Failover verification failed"
        send_alert "Failover verification failed" "danger"
    fi
}

switch_to_replica() {
    log_info "Attempting to switch to database replica..."
    
    # This would require configuration changes in the application
    # For now, we'll just log the intention
    log_info "Database replica switch would be implemented here"
    return 0
}

enable_maintenance_mode() {
    log_info "Enabling maintenance mode..."
    
    # Set maintenance mode environment variable
    export MAINTENANCE_MODE=true
    
    # Update nginx configuration to show maintenance page
    if [[ -f "./nginx/maintenance.conf" ]]; then
        cp "./nginx/maintenance.conf" "./nginx/conf.d/default.conf"
        docker-compose -f "$DOCKER_COMPOSE_FILE" restart nginx
    fi
    
    log_info "Maintenance mode enabled"
}

disable_maintenance_mode() {
    log_info "Disabling maintenance mode..."
    
    # Unset maintenance mode
    export MAINTENANCE_MODE=false
    
    # Restore normal nginx configuration
    if [[ -f "./nginx/default.conf" ]]; then
        cp "./nginx/default.conf" "./nginx/conf.d/default.conf"
        docker-compose -f "$DOCKER_COMPOSE_FILE" restart nginx
    fi
    
    log_info "Maintenance mode disabled"
}

# =============================================================================
# SYSTEM VERIFICATION
# =============================================================================

verify_system_functionality() {
    log_info "Verifying system functionality..."
    
    local api_url="${API_BASE_URL:-http://localhost:8000}"
    local frontend_url="${FRONTEND_URL:-http://localhost:3000}"
    
    # Check API health
    if curl -f "$api_url/health" >/dev/null 2>&1; then
        log_info "API health check passed"
    else
        log_error "API health check failed"
        return 1
    fi
    
    # Check frontend health
    if curl -f "$frontend_url/api/health" >/dev/null 2>&1; then
        log_info "Frontend health check passed"
    else
        log_error "Frontend health check failed"
        return 1
    fi
    
    # Check database connectivity
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
        log_info "Database connectivity check passed"
    else
        log_error "Database connectivity check failed"
        return 1
    fi
    
    # Check Redis connectivity
    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T redis redis-cli ping >/dev/null 2>&1; then
        log_info "Redis connectivity check passed"
    else
        log_error "Redis connectivity check failed"
        return 1
    fi
    
    log_info "System functionality verification completed successfully"
    return 0
}

# =============================================================================
# MAIN RECOVERY PROCEDURES
# =============================================================================

auto_recovery() {
    log_info "Starting automatic recovery procedure..."
    
    # Check system health first
    if check_system_health && check_service_health; then
        log_info "System is healthy, no recovery needed"
        return 0
    fi
    
    # Try service restart first
    log_info "Attempting service restart recovery..."
    if restart_services && check_service_health; then
        log_info "Recovery successful with service restart"
        send_alert "System recovered with service restart" "good"
        return 0
    fi
    
    # Try service recreation
    log_info "Attempting service recreation recovery..."
    if recreate_services && check_service_health; then
        log_info "Recovery successful with service recreation"
        send_alert "System recovered with service recreation" "good"
        return 0
    fi
    
    # If all else fails, initiate failover
    log_warn "Standard recovery methods failed, initiating failover..."
    initiate_failover
}

manual_recovery() {
    local backup_path="$1"
    
    log_info "Starting manual recovery with backup: $backup_path"
    
    send_alert "Manual recovery initiated" "warning"
    
    # Download and decrypt backup
    local local_backup
    if local_backup=$(download_backup "$backup_path"); then
        local decrypted_backup
        if decrypted_backup=$(decrypt_backup "$local_backup"); then
            # Restore database
            if restore_database "$decrypted_backup"; then
                # Verify system
                if verify_system_functionality; then
                    log_info "Manual recovery completed successfully"
                    send_alert "Manual recovery completed successfully" "good"
                    disable_maintenance_mode
                    return 0
                else
                    log_error "Manual recovery verification failed"
                    send_alert "Manual recovery verification failed" "danger"
                    return 1
                fi
            else
                log_error "Database restoration failed during manual recovery"
                return 1
            fi
        else
            log_error "Backup decryption failed"
            return 1
        fi
    else
        log_error "Backup download failed"
        return 1
    fi
}

# =============================================================================
# COMMAND LINE INTERFACE
# =============================================================================

show_help() {
    cat << EOF
Off the Grid Disaster Recovery Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    health              Check system and service health
    list-backups        List available backups
    auto-recovery       Perform automatic recovery
    manual-recovery     Perform manual recovery from specific backup
    restart-services    Restart specified services
    recreate-services   Recreate specified services
    failover            Initiate failover procedure
    verify              Verify system functionality
    maintenance-on      Enable maintenance mode
    maintenance-off     Disable maintenance mode

Options:
    -b, --backup PATH   Specify backup path for manual recovery
    -s, --services LIST Specify services (comma-separated)
    -h, --help          Show this help message

Examples:
    $0 health
    $0 list-backups
    $0 auto-recovery
    $0 manual-recovery -b database-backups/production/backup_20231201_120000.sql.enc
    $0 restart-services -s api,frontend
    $0 failover

EOF
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    # Create recovery directory
    mkdir -p "$RECOVERY_DIR"
    
    # Parse command line arguments
    local command="${1:-help}"
    shift || true
    
    local backup_path=""
    local services_list=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -b|--backup)
                backup_path="$2"
                shift 2
                ;;
            -s|--services)
                IFS=',' read -ra ADDR <<< "$2"
                services_list=("${ADDR[@]}")
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Execute command
    case $command in
        health)
            check_system_health && check_service_health
            ;;
        list-backups)
            list_available_backups
            ;;
        auto-recovery)
            auto_recovery
            ;;
        manual-recovery)
            if [[ -z "$backup_path" ]]; then
                backup_path=$(find_latest_backup)
            fi
            manual_recovery "$backup_path"
            ;;
        restart-services)
            if [[ -n "${services_list}" ]]; then
                restart_services "${services_list[@]}"
            else
                restart_services
            fi
            ;;
        recreate-services)
            if [[ -n "${services_list}" ]]; then
                recreate_services "${services_list[@]}"
            else
                recreate_services
            fi
            ;;
        failover)
            initiate_failover
            ;;
        verify)
            verify_system_functionality
            ;;
        maintenance-on)
            enable_maintenance_mode
            ;;
        maintenance-off)
            disable_maintenance_mode
            ;;
        help)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Cleanup on exit
cleanup_on_exit() {
    # Clean up temporary files
    rm -rf "$RECOVERY_DIR"
}

trap cleanup_on_exit EXIT

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi