using Quizz;

namespace Quizz.Tests;

public class GameServiceTests
{
    private static GameService MakeGame(params (string text, string[] options, int correct, int? timeLimit)[] questions)
    {
        var qs = questions.Length == 0
            ? new List<QuestionData>
            {
                new("Q1", new List<string> { "A", "B" }, 0, null),
                new("Q2", new List<string> { "X", "Y", "Z" }, 2, null)
            }
            : questions.Select(q => new QuestionData(q.text, q.options.ToList(), q.correct, q.timeLimit)).ToList();
        return new GameService(new QuizConfig("Test", 20, qs));
    }

    [Fact]
    public void NewGame_StartsInLobby()
    {
        var g = MakeGame();
        Assert.Equal(GamePhase.Lobby, g.Phase);
        Assert.Equal(-1, g.CurrentQuestionIndex);
        Assert.Null(g.CurrentQuestion);
    }

    [Fact]
    public void GetOrCreatePlayer_CreatesNewPlayer()
    {
        var g = MakeGame();
        var p = g.GetOrCreatePlayer("id1", "Alice");
        Assert.Equal("Alice", p.Pseudo);
        Assert.Equal(0, p.Score);
        Assert.Single(g.Players);
    }

    [Fact]
    public void GetOrCreatePlayer_UpdatesExistingPseudo()
    {
        var g = MakeGame();
        g.GetOrCreatePlayer("id1", "Alice");
        var p = g.GetOrCreatePlayer("id1", "Alicia");
        Assert.Equal("Alicia", p.Pseudo);
        Assert.Single(g.Players);
    }

    [Fact]
    public void StartNextQuestion_MovesToActiveAndIncrementsIndex()
    {
        var g = MakeGame();
        g.StartNextQuestion();
        Assert.Equal(GamePhase.QuestionActive, g.Phase);
        Assert.Equal(0, g.CurrentQuestionIndex);
        Assert.NotNull(g.CurrentQuestion);
        Assert.Equal("Q1", g.CurrentQuestion!.Text);
    }

    [Fact]
    public void StartNextQuestion_ResetsPerQuestionFields()
    {
        var g = MakeGame();
        var p = g.GetOrCreatePlayer("id1", "Alice");
        p.LastQuestionGain = 500;
        p.CurrentAnswer = 1;
        p.CurrentAnswerTime = DateTimeOffset.UtcNow;

        g.StartNextQuestion();

        Assert.Null(p.CurrentAnswer);
        Assert.Null(p.CurrentAnswerTime);
        Assert.Equal(0, p.LastQuestionGain);
    }

    [Fact]
    public void SubmitAnswer_IgnoredOutsideQuestionActive()
    {
        var g = MakeGame();
        g.GetOrCreatePlayer("id1", "Alice");
        g.SubmitAnswer("id1", 0);
        Assert.Null(g.Players["id1"].CurrentAnswer);
    }

    [Fact]
    public void SubmitAnswer_IgnoredForUnknownPlayer()
    {
        var g = MakeGame();
        g.StartNextQuestion();
        g.SubmitAnswer("ghost", 0);
        Assert.Empty(g.Players);
    }

    [Fact]
    public void SubmitAnswer_KeepsFirstAnswer()
    {
        var g = MakeGame();
        g.GetOrCreatePlayer("id1", "Alice");
        g.StartNextQuestion();

        g.SubmitAnswer("id1", 0);
        g.SubmitAnswer("id1", 1);

        Assert.Equal(0, g.Players["id1"].CurrentAnswer);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(2)]
    [InlineData(99)]
    public void SubmitAnswer_RejectsOutOfRangeIndex(int badIndex)
    {
        var g = MakeGame();
        g.GetOrCreatePlayer("id1", "Alice");
        g.StartNextQuestion();

        g.SubmitAnswer("id1", badIndex);

        Assert.Null(g.Players["id1"].CurrentAnswer);
    }

    [Fact]
    public void RevealAnswer_AwardsHighScoreForImmediateCorrectAnswer()
    {
        var g = MakeGame();
        g.GetOrCreatePlayer("id1", "Alice");
        g.StartNextQuestion();
        g.SubmitAnswer("id1", 0);

        g.RevealAnswer();

        var p = g.Players["id1"];
        Assert.True(p.LastQuestionGain >= 950, $"Expected >=950, got {p.LastQuestionGain}");
        Assert.True(p.LastQuestionGain <= 1000);
        Assert.Equal(p.LastQuestionGain, p.Score);
        Assert.Equal(GamePhase.AnswerRevealed, g.Phase);
    }

    [Fact]
    public void RevealAnswer_GivesZeroForWrongAnswer()
    {
        var g = MakeGame();
        g.GetOrCreatePlayer("id1", "Alice");
        g.StartNextQuestion();
        g.SubmitAnswer("id1", 1);

        g.RevealAnswer();

        Assert.Equal(0, g.Players["id1"].LastQuestionGain);
        Assert.Equal(0, g.Players["id1"].Score);
    }

    [Fact]
    public void RevealAnswer_GivesZeroForNoAnswer()
    {
        var g = MakeGame();
        g.GetOrCreatePlayer("id1", "Alice");
        g.StartNextQuestion();

        g.RevealAnswer();

        Assert.Equal(0, g.Players["id1"].LastQuestionGain);
    }

    [Fact]
    public void Scoring_FasterAnswerScoresHigherThanSlower()
    {
        var g = MakeGame(("Q", new[] { "A", "B" }, 0, 1));
        g.GetOrCreatePlayer("fast", "Fast");
        g.GetOrCreatePlayer("slow", "Slow");
        g.StartNextQuestion();

        g.SubmitAnswer("fast", 0);
        Thread.Sleep(600);
        g.SubmitAnswer("slow", 0);

        g.RevealAnswer();

        Assert.True(g.Players["fast"].LastQuestionGain > g.Players["slow"].LastQuestionGain,
            $"Expected fast ({g.Players["fast"].LastQuestionGain}) > slow ({g.Players["slow"].LastQuestionGain})");
    }

    [Fact]
    public void Reset_ZeroesScoresButKeepsPlayers()
    {
        var g = MakeGame();
        g.GetOrCreatePlayer("id1", "Alice");
        g.StartNextQuestion();
        g.SubmitAnswer("id1", 0);
        g.RevealAnswer();
        Assert.True(g.Players["id1"].Score > 0);

        g.Reset();

        Assert.Equal(GamePhase.Lobby, g.Phase);
        Assert.Equal(-1, g.CurrentQuestionIndex);
        Assert.Single(g.Players);
        Assert.Equal(0, g.Players["id1"].Score);
        Assert.Null(g.Players["id1"].CurrentAnswer);
    }

    [Fact]
    public void GetLeaderboard_OrdersByScoreDescending()
    {
        var g = MakeGame();
        var a = g.GetOrCreatePlayer("a", "A"); a.Score = 100;
        var b = g.GetOrCreatePlayer("b", "B"); b.Score = 300;
        var c = g.GetOrCreatePlayer("c", "C"); c.Score = 200;

        var board = g.GetLeaderboard();

        Assert.Equal(new[] { "B", "C", "A" }, board.Select(p => p.Pseudo));
    }

    [Fact]
    public void GetLeaderboard_TopParameterLimitsResults()
    {
        var g = MakeGame();
        for (int i = 0; i < 8; i++)
            g.GetOrCreatePlayer($"id{i}", $"P{i}").Score = i * 10;

        Assert.Equal(5, g.GetLeaderboard(5).Count);
        Assert.Equal(3, g.GetLeaderboard(3).Count);
    }

    [Fact]
    public void HasMoreQuestions_ReflectsRemainingQuestions()
    {
        var g = MakeGame();
        Assert.True(g.HasMoreQuestions);
        g.StartNextQuestion();
        Assert.True(g.HasMoreQuestions);
        g.StartNextQuestion();
        Assert.False(g.HasMoreQuestions);
    }

    [Fact]
    public void CountAnswered_CountsPlayersWhoAnswered()
    {
        var g = MakeGame();
        g.GetOrCreatePlayer("a", "A");
        g.GetOrCreatePlayer("b", "B");
        g.GetOrCreatePlayer("c", "C");
        g.StartNextQuestion();

        Assert.Equal(0, g.CountAnswered());
        g.SubmitAnswer("a", 0);
        Assert.Equal(1, g.CountAnswered());
        g.SubmitAnswer("c", 1);
        Assert.Equal(2, g.CountAnswered());
    }

    [Fact]
    public void GetTimeLimit_FallsBackToDefault()
    {
        var g = MakeGame(("Q", new[] { "A", "B" }, 0, null));
        g.StartNextQuestion();
        Assert.Equal(20, g.GetTimeLimit());
    }

    [Fact]
    public void GetTimeLimit_UsesPerQuestionOverride()
    {
        var g = MakeGame(("Q", new[] { "A", "B" }, 0, 5));
        g.StartNextQuestion();
        Assert.Equal(5, g.GetTimeLimit());
    }
}
