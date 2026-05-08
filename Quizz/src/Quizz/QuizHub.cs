using Microsoft.AspNetCore.SignalR;

namespace Quizz;

public class QuizHub : Hub
{
    private readonly GameService _game;
    private static readonly ConnectionMap Map = new();

    public QuizHub(GameService game) { _game = game; }

    public async Task RegisterPlayer(string playerId, string pseudo)
    {
        if (string.IsNullOrWhiteSpace(playerId) || string.IsNullOrWhiteSpace(pseudo)) return;
        var p = _game.GetOrCreatePlayer(playerId, pseudo.Trim());
        p.ConnectionId = Context.ConnectionId;
        Map.Set(Context.ConnectionId, playerId);
        await Groups.AddToGroupAsync(Context.ConnectionId, "players");
        await Clients.Caller.SendAsync("registered", new { p.Id, p.Pseudo, p.Score });
        await BroadcastPlayerList();
        await SendCurrentState(Context.ConnectionId);
    }

    public async Task RegisterHost()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "host");
        await BroadcastPlayerList();
        await SendCurrentState(Context.ConnectionId);
    }

    public async Task RegisterDisplay()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "display");
        await BroadcastPlayerList();
        await SendCurrentState(Context.ConnectionId);
    }

    public async Task SubmitAnswer(int answerIndex)
    {
        var playerId = Map.Get(Context.ConnectionId);
        if (playerId == null) return;
        _game.SubmitAnswer(playerId, answerIndex);
        await Clients.Caller.SendAsync("answerAccepted");
        await BroadcastAnswerCount();
    }

    public async Task NextQuestion()
    {
        if (!_game.HasMoreQuestions)
        {
            _game.Finish();
            await BroadcastState();
            await BroadcastFinalLeaderboard();
            return;
        }
        _game.StartNextQuestion();
        await BroadcastQuestion();
        await BroadcastState();
    }

    public async Task RevealAnswer()
    {
        _game.RevealAnswer();
        await BroadcastReveal();
        await BroadcastState();
    }

    public async Task ShowLeaderboard()
    {
        _game.ShowLeaderboard();
        await BroadcastLeaderboard();
        await BroadcastState();
    }

    public async Task ResetGame()
    {
        _game.Reset();
        await BroadcastState();
        await BroadcastPlayerList();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        Map.Remove(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    private async Task BroadcastPlayerList()
    {
        var data = _game.Players.Values
            .Select(p => new { p.Id, p.Pseudo, p.Score })
            .ToList();
        await Clients.Group("host").SendAsync("playerList", data);
        await Clients.Group("display").SendAsync("playerList", data);
    }

    private async Task BroadcastAnswerCount()
    {
        var payload = new { answered = _game.CountAnswered(), total = _game.Players.Count };
        await Clients.Group("host").SendAsync("answerCount", payload);
        await Clients.Group("display").SendAsync("answerCount", payload);
    }

    private async Task BroadcastQuestion()
    {
        var q = _game.CurrentQuestion!;
        var payload = new
        {
            index = _game.CurrentQuestionIndex,
            total = _game.Config.Questions.Count,
            text = q.Text,
            options = q.Options,
            timeLimit = _game.GetTimeLimit(),
            startedAt = _game.CurrentQuestionStart.ToUnixTimeMilliseconds()
        };
        await Clients.All.SendAsync("questionStarted", payload);
    }

    private async Task BroadcastReveal()
    {
        var q = _game.CurrentQuestion!;
        var counts = Enumerable.Range(0, q.Options.Count)
            .Select(i => _game.Players.Values.Count(p => p.CurrentAnswer == i))
            .ToList();
        await Clients.Group("host").SendAsync("answerRevealed", new
        {
            correctIndex = q.CorrectIndex,
            counts,
            players = _game.Players.Values.Select(p => new
            {
                p.Id, p.Pseudo, p.Score, p.LastQuestionGain, p.CurrentAnswer
            })
        });
        await Clients.Group("display").SendAsync("answerRevealed", new
        {
            correctIndex = q.CorrectIndex,
            counts
        });
        foreach (var p in _game.Players.Values)
        {
            if (p.ConnectionId == null) continue;
            await Clients.Client(p.ConnectionId).SendAsync("yourResult", new
            {
                correct = p.CurrentAnswer == q.CorrectIndex,
                lastQuestionGain = p.LastQuestionGain,
                score = p.Score,
                correctIndex = q.CorrectIndex,
                yourAnswer = p.CurrentAnswer
            });
        }
    }

    private async Task BroadcastLeaderboard()
    {
        var top = _game.GetLeaderboard(5)
            .Select((p, i) => new { rank = i + 1, p.Id, p.Pseudo, p.Score, p.LastQuestionGain })
            .ToList();
        await Clients.All.SendAsync("leaderboard", top);
    }

    private async Task BroadcastFinalLeaderboard()
    {
        var top = _game.GetLeaderboard(10)
            .Select((p, i) => new { rank = i + 1, p.Id, p.Pseudo, p.Score })
            .ToList();
        await Clients.All.SendAsync("finalLeaderboard", top);
    }

    private async Task BroadcastState() =>
        await Clients.All.SendAsync("phaseChanged", _game.Phase.ToString());

    private async Task SendCurrentState(string connId)
    {
        await Clients.Client(connId).SendAsync("phaseChanged", _game.Phase.ToString());
        if (_game.Phase == GamePhase.QuestionActive && _game.CurrentQuestion != null)
        {
            var q = _game.CurrentQuestion;
            await Clients.Client(connId).SendAsync("questionStarted", new
            {
                index = _game.CurrentQuestionIndex,
                total = _game.Config.Questions.Count,
                text = q.Text,
                options = q.Options,
                timeLimit = _game.GetTimeLimit(),
                startedAt = _game.CurrentQuestionStart.ToUnixTimeMilliseconds()
            });
        }
    }

    private sealed class ConnectionMap
    {
        private readonly Dictionary<string, string> _map = new();
        private readonly object _lock = new();
        public void Set(string conn, string player) { lock (_lock) _map[conn] = player; }
        public string? Get(string conn) { lock (_lock) return _map.TryGetValue(conn, out var v) ? v : null; }
        public void Remove(string conn) { lock (_lock) _map.Remove(conn); }
    }
}
