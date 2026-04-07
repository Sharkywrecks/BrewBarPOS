using Microsoft.AspNetCore.Mvc;

namespace BrewBar.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public abstract class BaseApiController : ControllerBase
{
}
