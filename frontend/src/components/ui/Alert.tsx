import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon, 
  InformationCircleIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  description?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: React.ReactNode;
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ 
    className, 
    variant = 'info', 
    title, 
    description, 
    dismissible, 
    onDismiss, 
    icon,
    children, 
    ...props 
  }, ref) => {
    const variants = {
      info: {
        container: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
        icon: 'text-blue-400',
        title: 'text-blue-800 dark:text-blue-200',
        description: 'text-blue-700 dark:text-blue-300',
        defaultIcon: InformationCircleIcon,
      },
      success: {
        container: 'bg-success-50 border-success-200 dark:bg-success-900/20 dark:border-success-800',
        icon: 'text-success-400',
        title: 'text-success-800 dark:text-success-200',
        description: 'text-success-700 dark:text-success-300',
        defaultIcon: CheckCircleIcon,
      },
      warning: {
        container: 'bg-warning-50 border-warning-200 dark:bg-warning-900/20 dark:border-warning-800',
        icon: 'text-warning-400',
        title: 'text-warning-800 dark:text-warning-200',
        description: 'text-warning-700 dark:text-warning-300',
        defaultIcon: ExclamationTriangleIcon,
      },
      danger: {
        container: 'bg-danger-50 border-danger-200 dark:bg-danger-900/20 dark:border-danger-800',
        icon: 'text-danger-400',
        title: 'text-danger-800 dark:text-danger-200',
        description: 'text-danger-700 dark:text-danger-300',
        defaultIcon: XCircleIcon,
      },
    };

    const variantConfig = variants[variant] || variants.info;
    const IconComponent = icon || variantConfig.defaultIcon;

    return (
      <div
        ref={ref}
        className={clsx(
          'border rounded-lg p-4',
          variantConfig.container,
          className
        )}
        role="alert"
        {...props}
      >
        <div className="flex">
          <div className="flex-shrink-0">
            {React.isValidElement(IconComponent) ? (
              React.cloneElement(IconComponent, {
                className: clsx('h-5 w-5', variantConfig.icon),
                ...IconComponent.props
              })
            ) : typeof IconComponent === 'function' ? (
              <IconComponent className={clsx('h-5 w-5', variantConfig.icon)} />
            ) : IconComponent ? (
              <span className={clsx('h-5 w-5 inline-block', variantConfig.icon)}>
                {typeof IconComponent === 'string' ? IconComponent : null}
              </span>
            ) : null}
          </div>
          
          <div className="ml-3 flex-1">
            {title && (
              <h3 className={clsx('text-sm font-medium', variantConfig.title)}>
                {title}
              </h3>
            )}
            {(description || children) && (
              <div className={clsx('text-sm', title ? 'mt-2' : '', variantConfig.description)}>
                {description || children}
              </div>
            )}
          </div>
          
          {dismissible && onDismiss && (
            <div className="ml-auto pl-3">
              <button
                type="button"
                onClick={onDismiss}
                className={clsx(
                  'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors',
                  variantConfig.icon,
                  'hover:bg-black/5 dark:hover:bg-white/5'
                )}
              >
                <span className="sr-only">Dismiss</span>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export { Alert };