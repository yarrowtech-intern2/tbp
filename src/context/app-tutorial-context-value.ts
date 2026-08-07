import { createContext, useContext } from 'react';

export type AppTutorialContextType = {
    isOpen: boolean;
    openTutorial: () => void;
};

export const AppTutorialContext = createContext<AppTutorialContextType | undefined>(undefined);

export const useAppTutorial = () => {
    const context = useContext(AppTutorialContext);

    if (context === undefined) {
        throw new Error('useAppTutorial must be used within an AppTutorialProvider');
    }

    return context;
};
