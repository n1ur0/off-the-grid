#!/bin/bash

# Database backup script for Off the Grid platform
# Performs automated database backups with encryption and S3 storage

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

# Environment variables (should be set externally)
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-off_the_grid}"
DB_USER="${DB_USER:-off_the_grid_user}"
DB_PASSWORD="${PGPASSWORD}"
S3_BUCKET="${S3_BUCKET}"
BACKUP_ENCRYPTION_KEY="${DB_BACKUP_ENCRYPTION_KEY}"

# Backup configuration
BACKUP_DIR="/tmp/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="off_the_grid_backup_${TIMESTAMP}.sql"
ENCRYPTED_BACKUP_FILENAME="${BACKUP_FILENAME}.enc"
S3_PREFIX="database-backups/production"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-90}"

# Logging configuration
LOG_FILE="/var/log/backup.log"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"

# =============================================================================
# LOGGING FUNCTIONS
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

# Send notification to Slack
send_slack_notification() {
    local message="$1"
    local color="${2:-good}"
    
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\"}]}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# Check if required tools are available
check_dependencies() {
    local missing_deps=()
    
    command -v pg_dump >/dev/null 2>&1 || missing_deps+=("pg_dump")
    command -v openssl >/dev/null 2>&1 || missing_deps+=("openssl")
    command -v aws >/dev/null 2>&1 || missing_deps+=("aws")
    command -v gzip >/dev/null 2>&1 || missing_deps+=("gzip")
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi
}

# Test database connection
test_db_connection() {
    log_info "Testing database connection..."
    
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
        log_error "Cannot connect to database $DB_HOST:$DB_PORT/$DB_NAME"
        send_slack_notification "Database backup failed: Cannot connect to database" "danger"
        exit 1
    fi
    
    log_info "Database connection successful"
}

# Create backup directory
setup_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    chmod 700 "$BACKUP_DIR"
    
    # Clean up old temporary files
    find "$BACKUP_DIR" -name "*.sql" -mtime +1 -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.enc" -mtime +1 -delete 2>/dev/null || true
}

# =============================================================================
# BACKUP FUNCTIONS
# =============================================================================

# Create database backup
create_backup() {
    log_info "Starting database backup..."
    
    local backup_path="$BACKUP_DIR/$BACKUP_FILENAME"
    local start_time=$(date +%s)
    
    # Perform the backup with verbose output
    if pg_dump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --format=custom \
        --compress=9 \
        --verbose \
        --no-password \
        --no-privileges \
        --no-owner \
        --file="$backup_path.custom" 2>&1 | tee -a "$LOG_FILE"; then
        
        # Also create SQL dump for compatibility
        pg_dump \
            --host="$DB_HOST" \
            --port="$DB_PORT" \
            --username="$DB_USER" \
            --dbname="$DB_NAME" \
            --format=plain \
            --verbose \
            --no-password \
            --no-privileges \
            --no-owner \
            --file="$backup_path" 2>&1 | tee -a "$LOG_FILE"
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_info "Database backup completed in ${duration} seconds"
        
        # Get backup file size
        local backup_size=$(du -h "$backup_path" | cut -f1)
        log_info "Backup file size: $backup_size"
        
        # Verify backup integrity
        if verify_backup "$backup_path"; then
            log_info "Backup integrity verification passed"
        else
            log_error "Backup integrity verification failed"
            return 1
        fi
        
    else
        log_error "Database backup failed"
        send_slack_notification "Database backup failed during pg_dump" "danger"
        return 1
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_path="$1"
    
    log_info "Verifying backup integrity..."
    
    # Check if file exists and is not empty
    if [[ ! -s "$backup_path" ]]; then
        log_error "Backup file is empty or does not exist"
        return 1
    fi
    
    # Verify SQL syntax (basic check)
    if head -n 10 "$backup_path" | grep -q "PostgreSQL database dump"; then
        log_info "Backup file appears to be a valid PostgreSQL dump"
        return 0
    else
        log_error "Backup file does not appear to be a valid PostgreSQL dump"
        return 1
    fi
}

# Encrypt backup file
encrypt_backup() {
    local backup_path="$BACKUP_DIR/$BACKUP_FILENAME"
    local encrypted_path="$BACKUP_DIR/$ENCRYPTED_BACKUP_FILENAME"
    
    log_info "Encrypting backup file..."
    
    if [[ -z "$BACKUP_ENCRYPTION_KEY" ]]; then
        log_error "Encryption key not provided"
        return 1
    fi
    
    # Compress and encrypt the backup
    if gzip < "$backup_path" | \
       openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
       -pass "pass:$BACKUP_ENCRYPTION_KEY" \
       -out "$encrypted_path"; then
        
        log_info "Backup encrypted successfully"
        
        # Remove unencrypted backup
        rm -f "$backup_path"
        
        return 0
    else
        log_error "Backup encryption failed"
        return 1
    fi
}

# Upload backup to S3
upload_to_s3() {
    local encrypted_path="$BACKUP_DIR/$ENCRYPTED_BACKUP_FILENAME"
    local s3_key="$S3_PREFIX/$ENCRYPTED_BACKUP_FILENAME"
    
    log_info "Uploading backup to S3..."
    
    # Upload with server-side encryption
    if aws s3 cp "$encrypted_path" "s3://$S3_BUCKET/$s3_key" \
        --server-side-encryption AES256 \
        --storage-class STANDARD_IA \
        --metadata "backup-date=$TIMESTAMP,database=$DB_NAME" \
        --quiet; then
        
        log_info "Backup uploaded to S3: s3://$S3_BUCKET/$s3_key"
        
        # Verify upload
        if aws s3 ls "s3://$S3_BUCKET/$s3_key" >/dev/null 2>&1; then
            log_info "Upload verification successful"
            
            # Clean up local encrypted file
            rm -f "$encrypted_path"
            
            return 0
        else
            log_error "Upload verification failed"
            return 1
        fi
    else
        log_error "Failed to upload backup to S3"
        return 1
    fi
}

# =============================================================================
# RETENTION MANAGEMENT
# =============================================================================

# Clean up old backups from S3
cleanup_old_backups() {
    log_info "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    # Calculate cutoff date
    local cutoff_date=$(date -d "-$RETENTION_DAYS days" '+%Y%m%d')
    
    # List and delete old backups
    local old_backups=$(aws s3 ls "s3://$S3_BUCKET/$S3_PREFIX/" --recursive | \
                       awk '{print $4}' | \
                       grep -E "off_the_grid_backup_[0-9]{8}_[0-9]{6}\.sql\.enc$" | \
                       while read -r backup; do
                           local backup_date=$(echo "$backup" | grep -o '[0-9]\{8\}' | head -1)
                           if [[ "$backup_date" < "$cutoff_date" ]]; then
                               echo "$backup"
                           fi
                       done)
    
    if [[ -n "$old_backups" ]]; then
        local count=0
        while IFS= read -r backup; do
            if aws s3 rm "s3://$S3_BUCKET/$backup" --quiet; then
                log_info "Deleted old backup: $backup"
                ((count++))
            else
                log_warn "Failed to delete old backup: $backup"
            fi
        done <<< "$old_backups"
        
        log_info "Cleaned up $count old backups"
    else
        log_info "No old backups to clean up"
    fi
}

# =============================================================================
# MONITORING AND ALERTING
# =============================================================================

# Create backup report
create_backup_report() {
    local status="$1"
    local error_msg="${2:-}"
    
    local report_file="$BACKUP_DIR/backup_report_$TIMESTAMP.json"
    
    cat > "$report_file" << EOF
{
    "timestamp": "$TIMESTAMP",
    "status": "$status",
    "database": "$DB_NAME",
    "backup_file": "$ENCRYPTED_BACKUP_FILENAME",
    "s3_location": "s3://$S3_BUCKET/$S3_PREFIX/$ENCRYPTED_BACKUP_FILENAME",
    "error_message": "$error_msg",
    "retention_days": $RETENTION_DAYS,
    "host": "$(hostname)"
}
EOF
    
    # Upload report to S3
    aws s3 cp "$report_file" "s3://$S3_BUCKET/$S3_PREFIX/reports/" \
        --server-side-encryption AES256 \
        --quiet 2>/dev/null || true
    
    rm -f "$report_file"
}

# Send backup completion notification
send_completion_notification() {
    local status="$1"
    local duration="$2"
    local error_msg="${3:-}"
    
    local color="good"
    local message="Database backup completed successfully in ${duration}s"
    
    if [[ "$status" != "success" ]]; then
        color="danger"
        message="Database backup failed: $error_msg"
    fi
    
    send_slack_notification "Off the Grid - $message" "$color"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    local start_time=$(date +%s)
    local status="success"
    local error_msg=""
    
    log_info "Starting Off the Grid database backup process"
    
    # Trap to ensure cleanup on exit
    trap 'cleanup_on_exit' EXIT
    
    # Check dependencies and setup
    check_dependencies
    setup_backup_dir
    test_db_connection
    
    # Perform backup steps
    if create_backup; then
        if encrypt_backup; then
            if upload_to_s3; then
                cleanup_old_backups
                log_info "Backup process completed successfully"
            else
                status="failed"
                error_msg="Failed to upload backup to S3"
            fi
        else
            status="failed"
            error_msg="Failed to encrypt backup"
        fi
    else
        status="failed"
        error_msg="Failed to create database backup"
    fi
    
    # Calculate duration and send notifications
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    create_backup_report "$status" "$error_msg"
    send_completion_notification "$status" "$duration" "$error_msg"
    
    if [[ "$status" != "success" ]]; then
        log_error "Backup process failed: $error_msg"
        exit 1
    fi
    
    log_info "Backup process completed successfully in ${duration} seconds"
}

# Cleanup function
cleanup_on_exit() {
    # Clean up any remaining temporary files
    find "$BACKUP_DIR" -name "*$TIMESTAMP*" -delete 2>/dev/null || true
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi