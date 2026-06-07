import { Check } from 'lucide-react';

/**
 * Reusable step indicator for multi-step wizards.
 * Shows current step with progress through previous steps.
 */
export function WizardStepIndicator({ currentStep, totalSteps, labels = [] }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNum) => (
        <div key={stepNum} className="flex items-center">
          <div
            className={`
              flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors
              ${currentStep === stepNum
                ? 'bg-primary text-primary-foreground'
                : currentStep > stepNum
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }
            `}
            aria-label={`Step ${stepNum} of ${totalSteps}${labels[stepNum - 1] ? `: ${labels[stepNum - 1]}` : ''}`}
          >
            {currentStep > stepNum ? <Check size={16} /> : stepNum}
          </div>
          {stepNum < totalSteps && (
            <div
              className={`
                w-8 h-0.5 mx-1
                ${currentStep > stepNum ? 'bg-primary' : 'bg-muted'}
              `}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default WizardStepIndicator;
