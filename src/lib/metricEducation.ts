export interface MetricLesson {
    name: string;
    description: string;
    zones?: any[];
}

export const LESSONS: Record<string, MetricLesson> = {};

export const zoneFor = (metric: string, value: number): string => "neutral";

export const formatValue = (metric: string, value: number): string => value.toString();

export const TONE_CLASS: Record<string, string> = {
    neutral: "text-gray-500",
    good: "text-green-500",
    bad: "text-red-500"
};

export const TONE_BG: Record<string, string> = {
    neutral: "bg-gray-100",
    good: "bg-green-100",
    bad: "bg-red-100"
};
