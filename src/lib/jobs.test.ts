import { describe, it, expect } from 'vitest';
import { sortByNewest, formatPostedDate, getDepartments, getLocations, filterJobs } from './jobs';
import type { Job } from '../types/job';

function makeJob(slug: string, postedDate: string): Job {
    return {
        slug,
        title: `Role ${slug}`,
        department: 'Technology',
        location: 'Remote',
        type: 'Full-time',
        remote: true,
        postedDate,
        summary: 'A role.',
    };
}

describe('sortByNewest', () => {
    it('orders jobs by posted date, newest first', () => {
        const jobs = [
            makeJob('a', '2027-01-01'),
            makeJob('b', '2027-03-15'),
            makeJob('c', '2027-02-10'),
        ];
        expect(sortByNewest(jobs).map((j) => j.slug)).toEqual(['b', 'c', 'a']);
    });

    it('does not mutate the input array', () => {
        const jobs = [makeJob('a', '2027-01-01'), makeJob('b', '2027-03-15')];
        const original = jobs.map((j) => j.slug);
        sortByNewest(jobs);
        expect(jobs.map((j) => j.slug)).toEqual(original);
    });
});

describe('formatPostedDate', () => {
    it('formats an ISO date as a readable string', () => {
        expect(formatPostedDate('2027-01-05')).toBe('January 5, 2027');
    });

    /**
     * Inline roles with shared and distinct labels to exercise independent filters,
     * incompatible combinations, deduplicated options, and preserved display order.
     */
    const filterFixtures: Job[] = [
      { ...makeJob('finance-us', '2027-04-05'), department: 'Finance', location: 'Woodinville, WA, USA' },
      { ...makeJob('technology', '2027-04-01'), department: 'Technology', location: 'Remote (US & Canada)' },
      { ...makeJob('finance-finland', '2027-03-10'), department: 'Finance', location: 'Helsinki, Finland' },
      { ...makeJob('compliance', '2027-03-01'), department: 'Compliance', location: 'Woodinville, WA, USA' },
    ];

    describe('filter options', () => {
      it('returns unique departments in alphabetical order', () => {
        expect(getDepartments(filterFixtures)).toEqual(['Compliance', 'Finance', 'Technology']);
      });

      it('returns unique, complete location labels in alphabetical order', () => {
        expect(getLocations(filterFixtures)).toEqual([
          'Helsinki, Finland',
          'Remote (US & Canada)',
          'Woodinville, WA, USA',
        ]);
      });

      it('returns no options for an empty collection', () => {
        expect(getDepartments([])).toEqual([]);
        expect(getLocations([])).toEqual([]);
      });

      it('does not mutate the jobs when deriving options', () => {
        const jobs = structuredClone(filterFixtures);
        getDepartments(jobs);
        getLocations(jobs);
        expect(jobs).toEqual(filterFixtures);
      });
    });

    describe('filterJobs', () => {
      it.each([
        {
          description: 'department independently',
          filters: { department: 'Finance', location: '' },
          slugs: ['finance-us', 'finance-finland'],
        },
        {
          description: 'location independently',
          filters: { department: '', location: 'Woodinville, WA, USA' },
          slugs: ['finance-us', 'compliance'],
        },
        {
          description: 'both filters with AND matching',
          filters: { department: 'Finance', location: 'Helsinki, Finland' },
          slugs: ['finance-finland'],
        },
        {
          description: 'an incompatible combination',
          filters: { department: 'Finance', location: 'Remote (US & Canada)' },
          slugs: [],
        },
        {
          description: 'an unknown department',
          filters: { department: 'Unknown', location: '' },
          slugs: [],
        },
        {
          description: 'an unknown location',
          filters: { department: '', location: 'Unknown' },
          slugs: [],
        },
        {
          description: 'complete rather than partial or case-insensitive values',
          filters: { department: 'finance', location: 'Woodinville' },
          slugs: [],
        },
      ])('filters $description', ({ filters, slugs }) => {
        expect(filterJobs(filterFixtures, filters).map((job) => job.slug)).toEqual(slugs);
      });

      it('clears either filter independently and resets both using the full collection', () => {
        const filters = { department: 'Finance', location: 'Woodinville, WA, USA' };
        expect(filterJobs(filterFixtures, filters).map((job) => job.slug)).toEqual(['finance-us']);
        expect(filterJobs(filterFixtures, { ...filters, department: '' }).map((job) => job.slug))
          .toEqual(['finance-us', 'compliance']);
        expect(filterJobs(filterFixtures, { ...filters, location: '' }).map((job) => job.slug))
          .toEqual(['finance-us', 'finance-finland']);
        expect(filterJobs(filterFixtures, { department: '', location: '' })).toEqual(filterFixtures);
      });

      it('returns no matches for an empty collection', () => {
        expect(filterJobs([], { department: '', location: '' })).toEqual([]);
        expect(filterJobs([], { department: 'Finance', location: 'Helsinki, Finland' })).toEqual([]);
      });

      it('preserves input order without mutating jobs or filters', () => {
        const jobs = structuredClone(filterFixtures);
        const filters = { department: 'Finance', location: '' };
        const originalFilters = { ...filters };
        const result = filterJobs(jobs, filters);

        expect(result.map((job) => job.slug)).toEqual(['finance-us', 'finance-finland']);
        expect(result).not.toBe(jobs);
        expect(jobs).toEqual(filterFixtures);
        expect(filters).toEqual(originalFilters);
      });
    });

    it('returns the raw value when the date is unparseable', () => {
        expect(formatPostedDate('not-a-date')).toBe('not-a-date');
    });
});
