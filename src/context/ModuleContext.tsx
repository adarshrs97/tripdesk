import React, { createContext, useContext, useState, useEffect } from 'react';
import { ModuleManifest, TopNavParent, INITIAL_MODULES } from '../modules/manifest';

interface ModuleContextType {
  modules: ModuleManifest[];
  toggleModule: (id: string, enabled: boolean) => void;
  isModuleEnabled: (id: string) => boolean;
  isViewEnabled: (viewId: string) => boolean;
  getModulesForNav: (parent: TopNavParent) => ModuleManifest[];
}

const STORAGE_KEY = 'starciti_module_registry';

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modules, setModules] = useState<ModuleManifest[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Record<string, boolean> = JSON.parse(stored);
        return INITIAL_MODULES.map(m => ({
          ...m,
          isEnabled: m.isCore ? true : (parsed[m.id] ?? m.isEnabled),
        }));
      }
    } catch (e) {
      console.error('Failed to parse module registry from storage', e);
    }
    return INITIAL_MODULES;
  });

  useEffect(() => {
    try {
      const stateMap = modules.reduce((acc, m) => {
        acc[m.id] = m.isEnabled;
        return acc;
      }, {} as Record<string, boolean>);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateMap));
    } catch (e) {
      console.error('Failed to persist module registry', e);
    }
  }, [modules]);

  const toggleModule = (id: string, enabled: boolean) => {
    setModules(prev =>
      prev.map(m => {
        if (m.id === id) {
          if (m.isCore) return m; // Core modules cannot be toggled
          return { ...m, isEnabled: enabled };
        }
        return m;
      })
    );
  };

  const isModuleEnabled = (id: string): boolean => {
    const mod = modules.find(m => m.id === id);
    return mod ? mod.isEnabled : false;
  };

  const isViewEnabled = (viewId: string): boolean => {
    const mod = modules.find(m => m.viewId === viewId);
    return mod ? mod.isEnabled : true;
  };

  const getModulesForNav = (parent: TopNavParent): ModuleManifest[] => {
    return modules.filter(m => m.navParent === parent && m.isEnabled);
  };

  return (
    <ModuleContext.Provider
      value={{
        modules,
        toggleModule,
        isModuleEnabled,
        isViewEnabled,
        getModulesForNav,
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
};

export const useModules = () => {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModules must be used within a ModuleProvider');
  }
  return context;
};
