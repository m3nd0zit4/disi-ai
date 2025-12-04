export interface ModelCapabilities {
    search: boolean;
    code: boolean;
    image: boolean;
    video: boolean;
    files: {
        github: boolean;
        figma: boolean;
        local: boolean;
    };
}

export interface SubModel {
    name: string;
    premium: boolean;
    enabled: boolean;
    id: string;
    capabilities: ModelCapabilities;
}

export interface AIModel {
    model: string;
    icon: string;
    premium: boolean;
    enabled: boolean;
    subModel: SubModel[];
}
