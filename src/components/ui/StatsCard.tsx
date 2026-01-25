import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning';
  className?: string;
}

const StatsCard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  variant = 'default',
  className 
}: StatsCardProps) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'card-stats-primary';
      case 'success':
        return 'card-stats-success';
      default:
        return 'card-stats';
    }
  };

  const getIconBg = () => {
    switch (variant) {
      case 'primary':
      case 'success':
        return 'bg-white/20';
      default:
        return 'bg-primary/10';
    }
  };

  const getIconColor = () => {
    switch (variant) {
      case 'primary':
      case 'success':
        return 'text-white';
      default:
        return 'text-primary';
    }
  };

  return (
    <div className={cn(getVariantStyles(), "animate-fade-in-up", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className={cn(
            "text-sm font-medium",
            variant === 'default' ? 'text-muted-foreground' : 'text-white/80'
          )}>
            {title}
          </p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {trend && (
            <p className={cn(
              "text-sm mt-2 flex items-center gap-1",
              variant === 'default' 
                ? trend.isPositive ? 'text-success' : 'text-destructive'
                : 'text-white/80'
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              <span className="opacity-60">vs last month</span>
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", getIconBg())}>
          <Icon className={cn("w-6 h-6", getIconColor())} />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
