using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using Quizz;
using QRCoder;

var builder = WebApplication.CreateBuilder(args);

var questionsPath = Path.Combine(builder.Environment.ContentRootPath, "questions.json");
if (!File.Exists(questionsPath))
    throw new FileNotFoundException($"questions.json introuvable : {questionsPath}");

var json = await File.ReadAllTextAsync(questionsPath);
var config = JsonSerializer.Deserialize<QuizConfig>(json, new JsonSerializerOptions
{
    PropertyNameCaseInsensitive = true
}) ?? throw new InvalidOperationException("questions.json invalide");

builder.Services.AddSingleton(new GameService(config));
builder.Services.AddSignalR();

builder.WebHost.UseUrls("http://0.0.0.0:5000");

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapPost("/api/join", (HttpContext ctx, JoinRequest req) =>
{
    if (string.IsNullOrWhiteSpace(req.Pseudo))
        return Results.BadRequest(new { error = "Pseudo requis" });
    var pseudo = req.Pseudo.Trim();
    if (pseudo.Length > 20) pseudo = pseudo[..20];

    var playerId = ctx.Request.Cookies["playerId"];
    if (string.IsNullOrEmpty(playerId)) playerId = Guid.NewGuid().ToString("N");

    var opts = new CookieOptions
    {
        HttpOnly = false,
        SameSite = SameSiteMode.Lax,
        Expires = DateTimeOffset.UtcNow.AddDays(7)
    };
    ctx.Response.Cookies.Append("playerId", playerId, opts);
    return Results.Ok(new { playerId, pseudo });
});

app.MapGet("/api/title", (GameService game) => Results.Ok(new { title = game.Config.Title }));

app.MapGet("/api/joinurl", () => Results.Ok(new { url = GetJoinUrl() }));

app.MapGet("/api/qrcode", () =>
{
    var generator = new QRCodeGenerator();
    var data = generator.CreateQrCode(GetJoinUrl(), QRCodeGenerator.ECCLevel.Q);
    var qr = new PngByteQRCode(data);
    var bytes = qr.GetGraphic(20);
    return Results.File(bytes, "image/png");
});

app.MapHub<QuizHub>("/hub");

PrintLanUrls();
app.Run();

return;

static void PrintLanUrls()
{
    Console.WriteLine();
    Console.WriteLine("=== Quizz Quiz ===");
    Console.WriteLine("Joueurs   :");
    foreach (var ip in GetLanIps())
        Console.WriteLine($"  http://{ip}:5000");
    Console.WriteLine("Host      :");
    foreach (var ip in GetLanIps())
        Console.WriteLine($"  http://{ip}:5000/host.html");
    Console.WriteLine("Affichage :");
    foreach (var ip in GetLanIps())
        Console.WriteLine($"  http://{ip}:5000/display.html");
    Console.WriteLine();
}

static string GetJoinUrl()
{
    var ip = GetLanIps().FirstOrDefault() ?? "localhost";
    return $"http://{ip}:5000/";
}

static IEnumerable<string> GetLanIps()
{
    try
    {
        return Dns.GetHostAddresses(Dns.GetHostName())
            .Where(ip => ip.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ip))
            .Select(ip => ip.ToString())
            .ToList();
    }
    catch { return ["localhost"]; }
}

internal record JoinRequest(string Pseudo);
