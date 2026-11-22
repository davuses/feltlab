import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('FeltLab ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090D12] text-[#E6EDF5] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#111722] border border-[#222D3D] rounded-xl p-6 space-y-4">
            <h1 className="text-xl font-semibold text-white">Session Interrupted</h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Something went wrong while rendering the studio table. Your saved local progress is intact.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors cursor-pointer"
            >
              Return to Studio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
