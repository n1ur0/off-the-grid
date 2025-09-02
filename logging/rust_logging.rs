/*!
Enhanced logging configuration for Off the Grid Rust CLI
Provides structured logging with correlation IDs, performance metrics, and security events
*/

use std::io::{self, Write};
use std::collections::HashMap;
use serde_json::{json, Value};
use tracing::{Event, Subscriber};
use tracing_subscriber::{
    fmt::{self, format::Writer, FormatEvent, FormatFields},
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter, Layer,
};
use tracing_appender::{non_blocking, rolling};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Correlation ID for request tracing
#[derive(Clone, Debug)]
pub struct CorrelationId(pub String);

impl CorrelationId {
    pub fn new() -> Self {
        Self(Uuid::new_v4().to_string())
    }

    pub fn from_string(id: String) -> Self {
        Self(id)
    }
}

/// Security event types
#[derive(Clone, Debug, serde::Serialize)]
pub enum SecurityEventType {
    AuthenticationAttempt,
    AuthenticationFailure,
    AuthorizationFailure,
    RateLimitExceeded,
    SuspiciousActivity,
    ConfigurationChange,
    PrivilegeEscalation,
}

/// Performance metrics
#[derive(Clone, Debug, serde::Serialize)]
pub struct PerformanceMetric {
    pub operation: String,
    pub duration_ms: f64,
    pub success: bool,
    pub details: HashMap<String, Value>,
}

/// Business event types
#[derive(Clone, Debug, serde::Serialize)]
pub enum BusinessEventType {
    GridOrderCreated,
    GridOrderRedeemed,
    GridOrderFailed,
    MatcherBotStarted,
    MatcherBotStopped,
    MatcherBotError,
    TokenPriceUpdated,
    WalletBalanceChanged,
}

/// Custom JSON formatter for structured logging
pub struct StructuredJsonFormatter;

impl<S, N> FormatEvent<S, N> for StructuredJsonFormatter
where
    S: Subscriber + for<'a> tracing_subscriber::registry::LookupSpan<'a>,
    N: for<'a> FormatFields<'a> + 'static,
{
    fn format_event(
        &self,
        ctx: &fmt::FmtContext<'_, S, N>,
        mut writer: Writer<'_>,
        event: &Event<'_>,
    ) -> std::fmt::Result {
        let metadata = event.metadata();
        
        let mut json_log = json!({
            "timestamp": Utc::now().to_rfc3339(),
            "level": metadata.level().to_string(),
            "target": metadata.target(),
            "service": "off-the-grid-cli",
            "environment": std::env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string())
        });

        // Add span context if available
        if let Some(span) = ctx.lookup_current() {
            let extensions = span.extensions();
            
            // Add correlation ID if present
            if let Some(correlation_id) = extensions.get::<CorrelationId>() {
                json_log["correlation_id"] = json!(correlation_id.0);
            }
            
            // Add span name
            json_log["span"] = json!(span.name());
        }

        // Extract message and fields from event
        let mut visitor = JsonVisitor::new();
        event.record(&mut visitor);
        
        if let Some(message) = visitor.message {
            json_log["message"] = json!(message);
        }
        
        // Add custom fields
        for (key, value) in visitor.fields {
            json_log[key] = value;
        }

        // Add file and line if available in debug mode
        if let Some(file) = metadata.file() {
            json_log["file"] = json!(file);
        }
        if let Some(line) = metadata.line() {
            json_log["line"] = json!(line);
        }

        writeln!(writer, "{}", json_log)?;
        Ok(())
    }
}

/// Visitor for extracting fields from events
struct JsonVisitor {
    message: Option<String>,
    fields: HashMap<String, Value>,
}

impl JsonVisitor {
    fn new() -> Self {
        Self {
            message: None,
            fields: HashMap::new(),
        }
    }
}

impl tracing::field::Visit for JsonVisitor {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        if field.name() == "message" {
            self.message = Some(format!("{:?}", value));
        } else {
            self.fields.insert(field.name().to_string(), json!(format!("{:?}", value)));
        }
    }

    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if field.name() == "message" {
            self.message = Some(value.to_string());
        } else {
            self.fields.insert(field.name().to_string(), json!(value));
        }
    }

    fn record_i64(&mut self, field: &tracing::field::Field, value: i64) {
        self.fields.insert(field.name().to_string(), json!(value));
    }

    fn record_u64(&mut self, field: &tracing::field::Field, value: u64) {
        self.fields.insert(field.name().to_string(), json!(value));
    }

    fn record_f64(&mut self, field: &tracing::field::Field, value: f64) {
        self.fields.insert(field.name().to_string(), json!(value));
    }

    fn record_bool(&mut self, field: &tracing::field::Field, value: bool) {
        self.fields.insert(field.name().to_string(), json!(value));
    }
}

/// Initialize comprehensive logging system
pub fn init_logging(log_level: &str, json_format: bool) -> Result<(), Box<dyn std::error::Error>> {
    // Create log directory
    std::fs::create_dir_all("/var/log/off-the-grid")?;

    // Create file appenders
    let file_appender = rolling::daily("/var/log/off-the-grid", "app.log");
    let (non_blocking, _guard) = non_blocking(file_appender);

    let error_appender = rolling::daily("/var/log/off-the-grid", "error.log");
    let (error_non_blocking, _error_guard) = non_blocking(error_appender);

    let security_appender = rolling::daily("/var/log/off-the-grid", "security.log");
    let (security_non_blocking, _security_guard) = non_blocking(security_appender);

    let performance_appender = rolling::daily("/var/log/off-the-grid", "performance.log");
    let (performance_non_blocking, _performance_guard) = non_blocking(performance_appender);

    // Create layers
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(log_level));

    let stdout_layer = if json_format {
        fmt::layer()
            .event_format(StructuredJsonFormatter)
            .with_writer(io::stdout)
            .with_filter(env_filter.clone())
            .boxed()
    } else {
        fmt::layer()
            .with_writer(io::stdout)
            .with_filter(env_filter.clone())
            .boxed()
    };

    let file_layer = if json_format {
        fmt::layer()
            .event_format(StructuredJsonFormatter)
            .with_writer(non_blocking)
            .with_filter(env_filter.clone())
            .boxed()
    } else {
        fmt::layer()
            .with_writer(non_blocking)
            .with_filter(env_filter.clone())
            .boxed()
    };

    let error_layer = fmt::layer()
        .event_format(StructuredJsonFormatter)
        .with_writer(error_non_blocking)
        .with_filter(EnvFilter::new("error"))
        .boxed();

    let security_layer = fmt::layer()
        .event_format(StructuredJsonFormatter)
        .with_writer(security_non_blocking)
        .with_filter(
            EnvFilter::new("info")
                .add_directive("security=info".parse()?)
        )
        .boxed();

    let performance_layer = fmt::layer()
        .event_format(StructuredJsonFormatter)
        .with_writer(performance_non_blocking)
        .with_filter(
            EnvFilter::new("info")
                .add_directive("performance=info".parse()?)
        )
        .boxed();

    // Initialize subscriber
    tracing_subscriber::registry()
        .with(stdout_layer)
        .with(file_layer)
        .with(error_layer)
        .with(security_layer)
        .with(performance_layer)
        .init();

    Ok(())
}

/// Log security event
pub fn log_security_event(
    event_type: SecurityEventType,
    user_id: Option<&str>,
    details: HashMap<String, Value>
) {
    tracing::warn!(
        target: "security",
        event_type = ?event_type,
        user_id = user_id,
        details = ?details,
        security_event = true,
        "Security event occurred"
    );
}

/// Log performance metric
pub fn log_performance_metric(metric: PerformanceMetric) {
    tracing::info!(
        target: "performance",
        operation = %metric.operation,
        duration_ms = metric.duration_ms,
        success = metric.success,
        details = ?metric.details,
        performance_metric = true,
        "Performance metric recorded"
    );
}

/// Log business event
pub fn log_business_event(
    event_type: BusinessEventType,
    user_id: Option<&str>,
    details: HashMap<String, Value>
) {
    tracing::info!(
        target: "business",
        event_type = ?event_type,
        user_id = user_id,
        details = ?details,
        business_event = true,
        "Business event occurred"
    );
}

/// Macro for timed operations
#[macro_export]
macro_rules! timed_operation {
    ($operation:expr, $code:block) => {{
        let start = std::time::Instant::now();
        let result = $code;
        let duration = start.elapsed();
        
        let success = result.is_ok();
        let performance_metric = PerformanceMetric {
            operation: $operation.to_string(),
            duration_ms: duration.as_millis() as f64,
            success,
            details: HashMap::new(),
        };
        
        log_performance_metric(performance_metric);
        result
    }};
}

/// Instrument span with correlation ID
pub fn with_correlation_id<F, R>(correlation_id: CorrelationId, f: F) -> R
where
    F: FnOnce() -> R,
{
    let span = tracing::info_span!("request", correlation_id = %correlation_id.0);
    let _enter = span.enter();
    
    span.record("correlation_id", &tracing::field::display(&correlation_id.0));
    f()
}

/// Create a new correlation ID span
pub fn new_correlation_span<F, R>(name: &'static str, f: F) -> R
where
    F: FnOnce(CorrelationId) -> R,
{
    let correlation_id = CorrelationId::new();
    let span = tracing::info_span!(name, correlation_id = %correlation_id.0);
    let _enter = span.enter();
    
    f(correlation_id)
}

/// Error logging utilities
pub mod error_logging {
    use super::*;
    use std::error::Error;

    pub fn log_error_with_context<E: Error>(
        error: &E,
        context: &str,
        details: HashMap<String, Value>
    ) {
        tracing::error!(
            error = %error,
            context = context,
            details = ?details,
            error_chain = ?error_chain(error),
            "Error occurred with context"
        );
    }

    pub fn log_critical_error<E: Error>(
        error: &E,
        context: &str,
        details: HashMap<String, Value>
    ) {
        tracing::error!(
            error = %error,
            context = context,
            details = ?details,
            error_chain = ?error_chain(error),
            critical = true,
            "Critical error occurred"
        );
    }

    fn error_chain(error: &dyn Error) -> Vec<String> {
        let mut chain = vec![error.to_string()];
        let mut source = error.source();
        
        while let Some(err) = source {
            chain.push(err.to_string());
            source = err.source();
        }
        
        chain
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_correlation_id_generation() {
        let id1 = CorrelationId::new();
        let id2 = CorrelationId::new();
        assert_ne!(id1.0, id2.0);
    }

    #[test]
    fn test_performance_metric_creation() {
        let metric = PerformanceMetric {
            operation: "test_operation".to_string(),
            duration_ms: 100.0,
            success: true,
            details: HashMap::new(),
        };
        
        assert_eq!(metric.operation, "test_operation");
        assert_eq!(metric.duration_ms, 100.0);
        assert!(metric.success);
    }
}