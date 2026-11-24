import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupplierProfile } from '../types';
import { INITIAL_SUPPLIERS } from '../data/initialSuppliers';

interface SupplierContextType {
  suppliers: SupplierProfile[];
  activeSupplier: SupplierProfile;
  setActiveSupplierId: (id: string) => void;
  addSupplier: (supplier: Omit<SupplierProfile, 'id'>) => void;
  updateSupplier: (id: string, supplier: Partial<SupplierProfile>) => void;
  deleteSupplier: (id: string) => void;
}

const STORAGE_KEY = 'starciti_supplier_profiles';

const SupplierContext = createContext<SupplierContextType | undefined>(undefined);

export const SupplierProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load supplier profiles from storage', e);
    }
    return INITIAL_SUPPLIERS;
  });

  const [activeSupplierId, setActiveSupplierId] = useState<string>(() => {
    return suppliers.find(s => s.isDefault)?.id || suppliers[0]?.id || 'supplier-starciti-group';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(suppliers));
    } catch (e) {
      console.error('Failed to persist supplier profiles', e);
    }
  }, [suppliers]);

  const activeSupplier = suppliers.find(s => s.id === activeSupplierId) || suppliers[0];

  const addSupplier = (newSup: Omit<SupplierProfile, 'id'>) => {
    const id = `supplier-${Date.now()}`;
    const created: SupplierProfile = { ...newSup, id };
    setSuppliers(prev => [...prev, created]);
  };

  const updateSupplier = (id: string, updates: Partial<SupplierProfile>) => {
    setSuppliers(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const deleteSupplier = (id: string) => {
    if (suppliers.length <= 1) {
      alert('Cannot delete the only supplier profile.');
      return;
    }
    setSuppliers(prev => prev.filter(s => s.id !== id));
    if (activeSupplierId === id) {
      const remaining = suppliers.filter(s => s.id !== id);
      setActiveSupplierId(remaining[0].id);
    }
  };

  return (
    <SupplierContext.Provider
      value={{
        suppliers,
        activeSupplier,
        setActiveSupplierId,
        addSupplier,
        updateSupplier,
        deleteSupplier,
      }}
    >
      {children}
    </SupplierContext.Provider>
  );
};

export const useSuppliers = () => {
  const context = useContext(SupplierContext);
  if (!context) {
    throw new Error('useSuppliers must be used within a SupplierProvider');
  }
  return context;
};
