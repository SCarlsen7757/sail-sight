using Microsoft.EntityFrameworkCore;

namespace SailSight.Api.Helpers;

public static class QueryPagination
{
    public static async Task<List<T>> PageAsync<T>(this IQueryable<T> query, HttpContext context, CancellationToken ct)
    {
        var offset = 0;
        if (context.Request.Query.TryGetValue("offset", out var value) &&
            (!int.TryParse(value, out offset) || offset < 0 || offset > 5_000_000))
            throw new BadHttpRequestException("Invalid collection offset.", 400);
        var items = await query.Skip(offset).Take(101).ToListAsync(ct);
        if (items.Count > 100)
        {
            items.RemoveAt(100);
            context.Response.Headers["X-Next-Offset"] = (offset + 100).ToString();
        }
        return items;
    }
}
