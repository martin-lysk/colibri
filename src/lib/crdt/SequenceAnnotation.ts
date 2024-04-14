
export type SequenceAnnotation = {
    version: string,
    start: number,
    end: number,
    growType: string,
    data: any,

    currentStart?: number,
    currentEnd?: number,
    currentVersions?: string[],
}