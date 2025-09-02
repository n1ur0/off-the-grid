import { clsx } from 'clsx';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'gray';
  className?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  color = 'primary', 
  className 
}: LoadingSpinnerProps) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  const colors = {
    primary: 'text-primary-500',
    white: 'text-white',
    gray: 'text-gray-500',
  };

  return (
    <svg
      className={clsx(
        'animate-spin',
        sizes[size],
        colors[color],
        className
      )}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export function LoadingOverlay({ message = 'Loading...', className }: LoadingOverlayProps) {
  return (
    <div className={clsx(
      'flex flex-col items-center justify-center p-8 space-y-4',
      className
    )}>
      <LoadingSpinner size="lg" />
      <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">
        {message}
      </p>
    </div>
  );
}

interface LoadingStateProps {
  loading: boolean;
  error?: string | null;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: (error: string) => React.ReactNode;
}

export function LoadingState({ 
  loading, 
  error, 
  children, 
  fallback,
  errorFallback 
}: LoadingStateProps) {
  if (loading) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <LoadingOverlay />
    );
  }

  if (error) {
    return errorFallback ? (
      <>{errorFallback(error)}</>
    ) : (
      <div className="text-center py-8">
        <div className="text-danger-500 text-4xl mb-4">⚠️</div>
        <p className="text-danger-600 dark:text-danger-400 font-medium">{error}</p>
      </div>
    );
  }

  return <>{children}</>;
}