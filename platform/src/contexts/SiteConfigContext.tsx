import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../api';
import type { SitePatientProfileConfig, SpecialtyTemplate, SpecialtyKey } from '../types';

interface SiteConfigContextValue {
    profileConfig: SitePatientProfileConfig | null;
    templates: Record<SpecialtyKey, SpecialtyTemplate> | null;
    // Returns true if the section should be visible based on enabled options.
    // Falls back to true if no config is set yet (show everything by default).
    isSectionVisible: (section: string) => boolean;
    // Returns true if a specific option ID is enabled.
    isOptionEnabled: (optionId: string) => boolean;
    reload: () => void;
}

const SiteConfigContext = createContext<SiteConfigContextValue>({
    profileConfig: null,
    templates: null,
    isSectionVisible: () => true,
    isOptionEnabled: () => true,
    reload: () => {},
});

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [profileConfig, setProfileConfig] = useState<SitePatientProfileConfig | null>(null);
    const [templates, setTemplates] = useState<Record<SpecialtyKey, SpecialtyTemplate> | null>(null);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        if (!user) return;
        api.getSiteSettings()
            .then(res => {
                setProfileConfig(res.site.patient_profile_config);
                setTemplates(res.specialty_templates);
            })
            .catch(() => {
                // No config yet — defaults (show everything) will apply
            });
    }, [user, version]);

    const enabledSet = new Set(profileConfig?.enabled_options || []);
    const hasConfig = (profileConfig?.enabled_options?.length ?? 0) > 0;

    // Build a map of section → option IDs from the selected specialties' templates
    const sectionOptionsMap: Record<string, string[]> = {};
    if (templates && profileConfig?.specialties) {
        for (const key of profileConfig.specialties) {
            for (const opt of templates[key]?.options || []) {
                if (!sectionOptionsMap[opt.section]) sectionOptionsMap[opt.section] = [];
                sectionOptionsMap[opt.section].push(opt.id);
            }
        }
    }

    const isSectionVisible = (section: string): boolean => {
        if (!hasConfig) return true; // no config set → show everything
        const optionsInSection = sectionOptionsMap[section] || [];
        if (optionsInSection.length === 0) return true; // section not in any template → always show
        return optionsInSection.some(id => enabledSet.has(id));
    };

    const isOptionEnabled = (optionId: string): boolean => {
        if (!hasConfig) return true;
        return enabledSet.has(optionId);
    };

    return (
        <SiteConfigContext.Provider value={{
            profileConfig, templates, isSectionVisible, isOptionEnabled,
            reload: () => setVersion(v => v + 1),
        }}>
            {children}
        </SiteConfigContext.Provider>
    );
}

export function useSiteConfig() {
    return useContext(SiteConfigContext);
}
