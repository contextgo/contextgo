import type { AgentCreateStepId } from './createFlow';
import { Button } from '@arco-design/web-react';
import React from 'react';
import styles from '../AssistantWorkspace.module.css';

type AgentCreateStatusFlowProps = {
  currentStep: AgentCreateStepId;
  highestUnlockedStep: AgentCreateStepId;
  steps: Array<{
    id: AgentCreateStepId;
    label: string;
  }>;
  onSelectStep: (stepId: AgentCreateStepId) => void;
};

const AgentCreateStatusFlow: React.FC<AgentCreateStatusFlowProps> = ({
  currentStep,
  highestUnlockedStep,
  steps,
  onSelectStep,
}) => {
  const highestUnlockedIndex = steps.findIndex((step) => step.id === highestUnlockedStep);

  return (
    <div className={styles.createStatusFlow}>
      {steps.map((step, index) => {
        const isCurrent = step.id === currentStep;
        const isCompleted = index < steps.findIndex((item) => item.id === currentStep);
        const isLocked = index > highestUnlockedIndex;
        const className = [
          styles.createStatusStep,
          isCurrent ? styles.createStatusStepCurrent : '',
          isCompleted ? styles.createStatusStepCompleted : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <React.Fragment key={step.id}>
            <Button className={className} type='text' disabled={isLocked} onClick={() => onSelectStep(step.id)}>
              <span className={styles.createStatusIndex}>{index + 1}</span>
              <span className={styles.createStatusLabel}>{step.label}</span>
            </Button>
            {index < steps.length - 1 ? <div className={styles.createStatusDivider} /> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default AgentCreateStatusFlow;
