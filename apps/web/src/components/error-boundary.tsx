import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { ErrorPage } from "@/components/error-page";

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage
          code={500}
          onRetry={() => {
            this.props.onReset?.();
            this.setState({ hasError: false });
          }}
        />
      );
    }
    return this.props.children;
  }
}
