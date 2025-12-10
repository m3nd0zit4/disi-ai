export interface ModelCapabilities {
    search: boolean;
    deepthought: boolean;
    image: boolean;
    video: boolean;
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
    iconLight: string;
    iconDark: string;
    premium: boolean;
    enabled: boolean;
    subModel: SubModel[];
}
