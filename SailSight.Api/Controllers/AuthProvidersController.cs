using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SailSight.Api.Auth;
using SailSight.Shared.Dtos.Auth;

namespace SailSight.Api.Controllers;

[ApiController, ApiVersion("1.0"), AllowAnonymous]
[Route("api/v{version:apiVersion}/auth/providers")]
public class AuthProvidersController(AuthOptions options) : ControllerBase
{
    [HttpGet]
    public ActionResult<AuthProvidersDto> Get() =>
        Ok(new AuthProvidersDto(!options.IsSingleUser && options.Local.Enabled, options.Mode));
}
