import { t } from 'i18next';
import { CircleCheck } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, GAP_SIZE_FOR_STEP_SETTINGS } from '@/lib/utils';

import {
  StepWizardCompletion,
  StepWizardTab,
  stepWizardUtils,
} from './step-wizard-utils';

const StepWizard = ({
  completion,
  setupContent,
  configureContent,
  testContent,
  finishLabel,
  onFinish,
}: StepWizardProps) => {
  const [activeTab, setActiveTab] = useState<StepWizardTab>(() =>
    stepWizardUtils.firstIncompleteTab(completion),
  );
  const tabs = stepWizardTabs();

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(toStepWizardTab(value))}
      className="flex flex-col flex-1 min-h-0"
    >
      <TabsList
        variant="outline"
        className="w-full shrink-0 justify-start gap-1 border-b border-gray-6 px-2"
      >
        {tabs.map((tab, index) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            variant="outline"
            className="gap-1.5 py-2 text-gray-11"
          >
            <StepWizardTabIndicator
              position={index + 1}
              done={completion[tab.value]}
            />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent
        value="setup"
        forceMount
        className="flex-1 min-h-0 flex-col data-[state=active]:flex data-[state=inactive]:hidden"
      >
        <StepWizardScrollBody>{setupContent}</StepWizardScrollBody>
        <StepWizardFooter
          label={t('Continue')}
          disabled={!completion.setup}
          disabledHint={t('Choose an app, an event and an account to continue')}
          onClick={() => setActiveTab('configure')}
        />
      </TabsContent>

      <TabsContent
        value="configure"
        forceMount
        className="flex-1 min-h-0 flex-col data-[state=active]:flex data-[state=inactive]:hidden"
      >
        <StepWizardScrollBody>{configureContent}</StepWizardScrollBody>
        <StepWizardFooter
          label={t('Continue')}
          disabled={!completion.configure}
          disabledHint={t('Fill in the required fields to continue')}
          onClick={() => setActiveTab('test')}
        />
      </TabsContent>

      <TabsContent value="test" className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">{testContent}</div>
        <StepWizardFooter
          label={finishLabel}
          disabled={false}
          disabledHint=""
          onClick={onFinish}
        />
      </TabsContent>
    </Tabs>
  );
};
StepWizard.displayName = 'StepWizard';
export { StepWizard };

const StepWizardTabIndicator = ({
  position,
  done,
}: {
  position: number;
  done: boolean;
}) => {
  if (done) {
    return (
      <CircleCheck
        className="size-4 text-success-11"
        aria-label={t('Completed')}
      />
    );
  }
  return (
    <span className="flex size-4 items-center justify-center rounded-full border border-gray-7 text-xss">
      {position}
    </span>
  );
};

const StepWizardScrollBody = ({ children }: { children: React.ReactNode }) => (
  <ScrollArea className="flex-1 min-h-0">
    <div
      className={cn('flex flex-col px-4 pb-6 pt-3', GAP_SIZE_FOR_STEP_SETTINGS)}
    >
      {children}
    </div>
  </ScrollArea>
);

const StepWizardFooter = ({
  label,
  disabled,
  disabledHint,
  onClick,
}: {
  label: string;
  disabled: boolean;
  disabledHint: string;
  onClick: () => void;
}) => (
  <div className="shrink-0 flex flex-col gap-1.5 border-t border-gray-6 px-4 py-3">
    {disabled && <p className="text-xs text-gray-11">{disabledHint}</p>}
    <Button
      type="button"
      className="w-full"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  </div>
);

function stepWizardTabs(): { value: StepWizardTab; label: string }[] {
  return [
    { value: 'setup', label: t('Setup') },
    { value: 'configure', label: t('Configure') },
    { value: 'test', label: t('Test') },
  ];
}

function toStepWizardTab(value: string): StepWizardTab {
  return value === 'configure' || value === 'test' ? value : 'setup';
}

type StepWizardProps = {
  completion: StepWizardCompletion;
  setupContent: React.ReactNode;
  configureContent: React.ReactNode;
  testContent: React.ReactNode;
  finishLabel: string;
  onFinish: () => void;
};
