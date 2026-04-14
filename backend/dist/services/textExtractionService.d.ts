export type ExtractResult = {
    text: string;
    ok: true;
} | {
    text?: string;
    ok: false;
    error: string;
};
export declare function extractTextFromFile(filePath: string, fileType: string): Promise<ExtractResult>;
/** Split text into chunks (e.g. for embedding). Simple sentence/paragraph boundary split. */
export declare function chunkText(text: string, maxChunkSize?: number, overlap?: number): string[];
