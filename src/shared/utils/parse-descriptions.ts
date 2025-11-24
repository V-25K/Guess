/**
 * Utility to parse image_descriptions from database
 * Database stores it as JSON string, we need it as array
 */

export function parseImageDescriptions(imageDescriptions: string[] | string | undefined): string[] {
    if (!imageDescriptions) {
        return [];
    }

    // If it's already an array, return it
    if (Array.isArray(imageDescriptions)) {
        return imageDescriptions;
    }

    // If it's a string, try to parse it as JSON
    if (typeof imageDescriptions === 'string') {
        try {
            const parsed = JSON.parse(imageDescriptions);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Failed to parse image_descriptions:', e);
            return [];
        }
    }

    return [];
}
