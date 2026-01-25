import { cn } from '@/lib/utils';

interface CapacityIndicatorProps {
  current: number;
  max: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const CapacityIndicator = ({ 
  current, 
  max, 
  showLabel = true,
  size = 'md' 
}: CapacityIndicatorProps) => {
  const percentage = Math.min((current / max) * 100, 100);
  
  const getColorClass = () => {
    if (percentage < 60) return 'capacity-fill-low';
    if (percentage < 85) return 'capacity-fill-medium';
    return 'capacity-fill-high';
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'h-1.5';
      case 'lg': return 'h-3';
      default: return 'h-2';
    }
  };

  return (
    <div className="w-full">
      <div className={cn("capacity-bar", getSizeClass())}>
        <div 
          className={cn("capacity-fill", getColorClass())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
          <span>{current} / {max}</span>
          <span className={cn(
            percentage >= 85 && "text-destructive font-medium",
            percentage >= 60 && percentage < 85 && "text-warning font-medium"
          )}>
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default CapacityIndicator;
