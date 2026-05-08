using System.Collections.Concurrent;

namespace Quizz;

public record QuestionData(string Text, List<string> Options, int CorrectIndex, int? TimeLimit);

public record QuizConfig(string Title, int DefaultTimeLimit, List<QuestionData> Questions);

public class Player
{
    public string Id { get; init; } = "";
    public string Pseudo { get; set; } = "";
    public int Score { get; set; }
    public string? ConnectionId { get; set; }
    public int? CurrentAnswer { get; set; }
    public DateTimeOffset? CurrentAnswerTime { get; set; }
    public int LastQuestionGain { get; set; }
}

public enum GamePhase { Lobby, QuestionActive, AnswerRevealed, Leaderboard, Finished }

public class GameService
{
    public QuizConfig Config { get; }
    public ConcurrentDictionary<string, Player> Players { get; } = new();
    public GamePhase Phase { get; private set; } = GamePhase.Lobby;
    public int CurrentQuestionIndex { get; private set; } = -1;
    public DateTimeOffset CurrentQuestionStart { get; private set; }

    public GameService(QuizConfig config) { Config = config; }

    public QuestionData? CurrentQuestion =>
        CurrentQuestionIndex >= 0 && CurrentQuestionIndex < Config.Questions.Count
            ? Config.Questions[CurrentQuestionIndex] : null;

    public int GetTimeLimit() => CurrentQuestion?.TimeLimit ?? Config.DefaultTimeLimit;

    public Player GetOrCreatePlayer(string id, string pseudo) =>
        Players.AddOrUpdate(id,
            _ => new Player { Id = id, Pseudo = pseudo },
            (_, p) => { p.Pseudo = pseudo; return p; });

    public bool HasMoreQuestions => CurrentQuestionIndex + 1 < Config.Questions.Count;

    public void StartNextQuestion()
    {
        CurrentQuestionIndex++;
        CurrentQuestionStart = DateTimeOffset.UtcNow;
        Phase = GamePhase.QuestionActive;
        foreach (var p in Players.Values)
        {
            p.CurrentAnswer = null;
            p.CurrentAnswerTime = null;
            p.LastQuestionGain = 0;
        }
    }

    public void SubmitAnswer(string playerId, int answerIndex)
    {
        if (Phase != GamePhase.QuestionActive) return;
        if (!Players.TryGetValue(playerId, out var p)) return;
        if (p.CurrentAnswer != null) return;
        var q = CurrentQuestion;
        if (q == null) return;
        if (answerIndex < 0 || answerIndex >= q.Options.Count) return;
        p.CurrentAnswer = answerIndex;
        p.CurrentAnswerTime = DateTimeOffset.UtcNow;
    }

    public void RevealAnswer()
    {
        var q = CurrentQuestion;
        if (q == null) return;
        var timeLimit = GetTimeLimit();
        foreach (var p in Players.Values)
        {
            if (p.CurrentAnswer == q.CorrectIndex && p.CurrentAnswerTime.HasValue)
            {
                var responseTime = (p.CurrentAnswerTime.Value - CurrentQuestionStart).TotalSeconds;
                var ratio = Math.Clamp(responseTime / timeLimit, 0, 1);
                var gain = (int)Math.Round(1000 * (1 - 0.5 * ratio));
                p.LastQuestionGain = gain;
                p.Score += gain;
            }
            else
            {
                p.LastQuestionGain = 0;
            }
        }
        Phase = GamePhase.AnswerRevealed;
    }

    public void ShowLeaderboard() => Phase = GamePhase.Leaderboard;
    public void Finish() => Phase = GamePhase.Finished;

    public void Reset()
    {
        foreach (var p in Players.Values)
        {
            p.Score = 0;
            p.LastQuestionGain = 0;
            p.CurrentAnswer = null;
            p.CurrentAnswerTime = null;
        }
        CurrentQuestionIndex = -1;
        Phase = GamePhase.Lobby;
    }

    public List<Player> GetLeaderboard(int top = 5) =>
        Players.Values.OrderByDescending(p => p.Score).Take(top).ToList();

    public int CountAnswered() => Players.Values.Count(p => p.CurrentAnswer != null);
}
