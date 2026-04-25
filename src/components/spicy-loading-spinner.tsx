export function SpicyLoadingSpinner() {
  return (
    <div className="flex h-48 items-center justify-center">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary animate-spin" style={{ animationDuration: '1.2s' }} />
        
        <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-primary/60 border-l-primary/60 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
        
        <div className="absolute inset-4 rounded-full border-4 border-primary/40 animate-pulse" style={{ animationDuration: '0.8s' }} />
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-primary animate-ping" style={{ animationDuration: '1s' }} />
          <div className="absolute w-3 h-3 rounded-full bg-primary" />
        </div>
        
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '2s' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary/80" />
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '2s', animationDelay: '0.5s' }}>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary/80" />
        </div>
      </div>
    </div>
  );
}
