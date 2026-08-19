import React, { useState } from 'react';
import { CrmLeadsPanel } from './CrmLeadsPanel';
import { CrmTravelersPanel } from './CrmTravelersPanel';
import './crm-leads-panel.css';

type CrmTab = 'leads' | 'travelers';

const TABS: { key: CrmTab; label: string }[] = [
    { key: 'leads', label: 'Leads' },
    { key: 'travelers', label: 'Travelers' },
];

export const CrmPanel: React.FC = () => {
    const [tab, setTab] = useState<CrmTab>('leads');

    return (
        <div className="crm-root">
            <div className="crm-root-head">
                <div>
                    <h1>CRM</h1>
                    <small>Leads, traveler accounts, and relationship notes for admin and marketing</small>
                </div>
                <div className="crm-tabs" role="tablist">
                    {TABS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            role="tab"
                            aria-selected={tab === item.key}
                            className={`crm-tab${tab === item.key ? ' is-active' : ''}`}
                            onClick={() => setTab(item.key)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'leads' ? <CrmLeadsPanel /> : <CrmTravelersPanel />}
        </div>
    );
};
