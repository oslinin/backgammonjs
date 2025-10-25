var model = require('./model.js');
var comm = require('./comm.js');

/**
 * Manages a solo game, where the user plays both sides.
 * @constructor
 */
function SoloGameManager() {
  this.match = null;
  this.rule = null;
}

SoloGameManager.prototype.init = function (rule) {
  this.rule = rule;
  // Create a new match
  this.match = model.Match.createNew(this.rule);

  // Create two players
  var player1 = model.Player.createNew();
  player1.name = 'Player 1';
  player1.currentPieceType = model.PieceType.WHITE;
  model.Match.addHostPlayer(this.match, player1);

  var player2 = model.Player.createNew();
  player2.name = 'Player 2';
  player2.currentPieceType = model.PieceType.BLACK;
  model.Match.addGuestPlayer(this.match, player2);

  // Create a new game
  model.Match.createNewGame(this.match, this.rule);
  this.match.currentGame.hasStarted = true;
  this.match.currentGame.turnPlayer = this.match.host;
};

SoloGameManager.prototype.rollDice = function() {
    var game = this.match.currentGame;
    var dice = this.rule.rollDice(game);
    game.turnDice = dice;
    model.Game.snapshotState(game);

    return { result: true, dice: dice };
};

SoloGameManager.prototype.movePiece = function(piece, steps) {
    var game = this.match.currentGame;
    var player = game.turnPlayer;

    var validationResult = this.rule.validateMove(game, player, piece, steps);
    if (!validationResult) {
        return { result: false, errorMessage: "Invalid move." };
    }

    var actions = this.rule.getMoveActions(game.state, piece, steps);
    if (actions.length === 0) {
      return { result: false, errorMessage: "Invalid move." };
    }

    this.rule.applyMoveActions(game.state, actions);
    this.rule.markAsPlayed(game, steps);
    game.moveSequence++;

    return { result: true, moveActionList: actions };
};

SoloGameManager.prototype.confirmMoves = function() {
    var game = this.match.currentGame;
    var player = game.turnPlayer;

    if (!this.rule.validateConfirm(game, player)) {
        return { event: 'error', errorMessage: 'Cannot confirm moves.' };
    }

    game.turnConfirmed = true;

    if (this.rule.hasWon(game.state, player)) {
        game.isOver = true;
        var score = this.rule.getGameScore(game.state, player);
        this.match.score[player.currentPieceType] += score;

        if (this.match.score[player.currentPieceType] >= this.match.length) {
            this.match.isOver = true;
            return { event: comm.Message.EVENT_MATCH_OVER, winner: player };
        } else {
            return { event: comm.Message.EVENT_GAME_OVER, winner: player };
        }
    } else {
        this.rule.nextTurn(this.match);
        return { event: comm.Message.EVENT_TURN_START, turnPlayer: game.turnPlayer };
    }
};

SoloGameManager.prototype.undoMoves = function() {
    var game = this.match.currentGame;
    var player = game.turnPlayer;
    if (!this.rule.validateUndo(game, player)) {
        return { result: false, errorMessage: "Cannot undo moves." };
    }
    model.Game.restoreState(game);
    return { result: true };
};

module.exports.SoloGameManager = SoloGameManager;
