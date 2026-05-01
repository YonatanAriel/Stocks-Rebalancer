export function SpicyLoadingSpinner() {
  return (
    <div className="flex h-48 items-center justify-center">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-2 border-transparent border-t-primary border-r-primary animate-spin rounded-none" style={{ animationDuration: '0.8s' }} />
        <div className="absolute inset-2 border-2 border-transparent border-b-primary/60 border-l-primary/60 animate-spin rounded-none" style={{ animationDuration: '1.2s', animationDirection: 'reverse' }} />
        <div className="absolute inset-4 border border-primary/40 animate-pulse rounded-none" style={{ animationDuration: '1s' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-primary animate-ping rounded-none" style={{ animationDuration: '0.8s' }} />
          <div className="absolute w-2 h-2 bg-primary rounded-none" />
        </div>
      </div>
    </div>
  );
}
