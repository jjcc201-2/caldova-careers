/**
 * Pure, side-effect-free helpers for working with job postings.
 *
 * These operate on plain `Job[]` arrays (already loaded from the content
 * collection by the calling page) so they can be unit tested without the Astro
 * content runtime or a database.
 */
import type { Job } from '../types/job';

/** Exact-match selections for narrowing a role listing. */
export interface JobFilters {
  /** Complete department label, or an empty string to include all departments. */
  department: string;
  /** Complete location label, or an empty string to include all locations. */
  location: string;
}

/**
 * Derives the department options from the complete role collection.
 *
 * @param jobs - Roles mapped from the content collection.
 * @returns A new, alphabetically sorted array of unique department labels.
 */
export function getDepartments(jobs: Job[]): string[] {
  return [...new Set(jobs.map((job) => job.department))].sort();
}

/**
 * Derives location options without changing posting labels or grouping remote roles.
 *
 * @param jobs - Roles mapped from the content collection.
 * @returns A new, alphabetically sorted array of unique location labels.
 */
export function getLocations(jobs: Job[]): string[] {
  return [...new Set(jobs.map((job) => job.location))].sort();
}

/**
 * Selects roles matching every active filter without mutating either input.
 *
 * @remarks
 * Matching is exact and case-sensitive. Empty selections impose no restriction;
 * unknown nonempty selections produce no matches. Pass the complete collection
 * on each call so clearing a filter can restore previously excluded roles.
 *
 * @param jobs - The complete role collection in its intended display order.
 * @param filters - Department and location selections combined with AND matching.
 * @returns A new array of matching roles, preserving their input order.
 */
export function filterJobs(jobs: Job[], filters: JobFilters): Job[] {
  return jobs.filter((job) =>
    (filters.department === '' || job.department === filters.department) &&
    (filters.location === '' || job.location === filters.location),
  );
}

/** Return jobs sorted by posted date, newest first (does not mutate input). */
export function sortByNewest(jobs: Job[]): Job[] {
    return [...jobs].sort(
        (a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime(),
    );
}

/**
 * Format an ISO-8601 date as a human-readable posted date,
 * e.g. "January 5, 2027". Falls back to the raw value if unparseable.
 */
export function formatPostedDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return iso;
    }
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    });
}
