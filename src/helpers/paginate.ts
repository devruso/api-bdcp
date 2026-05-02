type PaginateParams = {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: string;
    search?: string;
    filters?: Record<string, unknown>;
}

export const paginate = (data: unknown[], { page, limit, search, sortBy, sortOrder, filters }: PaginateParams) => {
    const results = data.slice(limit * page, limit * (page + 1));
    const total = data.length;
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    return {
        results,
        total,
        meta: {
            page,
            limit,
            total,
            totalPages,
            sortBy,
            sortOrder,
            search,
            filters,
        }
    };
};
