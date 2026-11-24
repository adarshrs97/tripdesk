import React from 'react';
import { ViewId } from '../../types';

interface PlaceholderViewProps {
  viewId: ViewId;
  title: string;
  milestone: string;
  description: string;
  features: string[];
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({
  title,
  milestone,
  description,
  features,
}) => {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="bg-card border border-line rounded-xl p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-tint text-brand font-semibold">
            {milestone}
          </span>
          <span className="text-xs text-ink-faint">Architecture &amp; Scaffolding Ready</span>
        </div>
        
        <h2 className="text-2xl font-heading font-bold text-ink mt-2">
          {title}
        </h2>
        <p className="text-sm text-ink-soft mt-1 max-w-2xl">
          {description}
        </p>

        <div className="mt-6 pt-6 border-t border-line">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">
            Planned Specifications &amp; Modules
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.map((feat, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 p-3 rounded-lg bg-paper border border-line text-xs text-ink"
              >
                <div className="w-4 h-4 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0 mt-0.5">
                  ✓
                </div>
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
