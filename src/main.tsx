import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { DailyLimitProvider } from './hooks/useDailyLimit.tsx';
import { BudgetsProvider } from './hooks/useBudgets.tsx';
import { PlansProvider } from './hooks/usePlans.tsx';
import { DebtsProvider } from './hooks/useDebts.tsx';
import { NetWorthProvider } from './hooks/useNetWorth.tsx';
import { RulesProvider } from './hooks/useRules.tsx';
import { PrivacyProvider } from './hooks/usePrivacy.tsx';
import { LanguageProvider } from './i18n';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <LanguageProvider>
      <DailyLimitProvider>
        <BudgetsProvider>
          <PlansProvider>
            <DebtsProvider>
              <NetWorthProvider>
                <RulesProvider>
                  <PrivacyProvider>
                    <App />
                  </PrivacyProvider>
                </RulesProvider>
              </NetWorthProvider>
            </DebtsProvider>
          </PlansProvider>
        </BudgetsProvider>
      </DailyLimitProvider>
    </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>
);
