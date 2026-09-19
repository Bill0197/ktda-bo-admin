import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon } from "lucide-react";
import { Button } from "./Primitives";

type Props = { children: ReactNode; appName?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.appName ?? "app"}] uncaught render error`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center flex flex-col items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-danger-bg text-danger flex items-center justify-center">
              <AlertOctagon size={22} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text mb-1.5">Something went wrong</h1>
              <p className="text-sm text-text-soft">
                {this.props.appName ?? "This app"} hit an unexpected error. Reloading usually fixes it — if it
                keeps happening, this is worth reporting.
              </p>
            </div>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
