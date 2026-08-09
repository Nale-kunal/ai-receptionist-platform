import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { telemetry } from '../../services/telemetry';

interface Props {
  widgetName: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    telemetry.track('widget_failed', {
      module: 'dashboard_widget',
      action: 'widget_render_crash',
      result: 'failure',
      errorCode: error.name,
      payload: {
        widgetName: this.props.widgetName,
        errorMessage: error.message,
        componentStack: errorInfo.componentStack,
      },
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Card style={{ borderLeft: '4px solid var(--error)', padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '10px' }}>
            <AlertTriangle size={24} style={{ color: 'var(--error)' }} />
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 4px' }}>
                {this.props.widgetName} Temporarily Unavailable
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                This widget encountered a rendering error. Other dashboard components remain fully functional.
              </p>
            </div>
            <Button
              onClick={this.handleRetry}
              variant="secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}
            >
              <RefreshCw size={14} /> Retry Widget
            </Button>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}
