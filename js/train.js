//Alexander Shieh, 2015
//Adapted from John Watson, 2014
//Licensed under the terms of the MIT License

//Heuristic Reward Function
getReward = function(vx, vy, ang, dist) {
    return  60/(dist*0.01+0.1) + 10/(Math.abs(vx)*0.1+0.1) + 10/(Math.abs(vy)*0.1+0.1) + 10/(Math.abs(90-ang)+0.1);
}
//Define NN
var NeuralNetwork= function(){};
var layer_defs = [];

layer_defs.push({type: 'input', out_sx:1, out_sy:1, out_depth: 24});
layer_defs.push({type: 'fc', num_neurons: 10, activation: 'sigmoid'});
layer_defs.push({type: 'fc', num_neurons: 6, activation: 'sigmoid'});
layer_defs.push({type: 'fc', num_neurons: 4, activation: 'sigmoid'});
layer_defs.push({type: 'regression', num_neurons: 4});
var net = new convnetjs.Net();
net.makeLayers(layer_defs);
var trainer = new convnetjs.Trainer(net, {method: 'adadelta', l2_decay: 0.001, batch_size: 10});

var trainCnt = 0;
var trainFlag = 0;
var trainSeq = [];
var endFlag = 0;
//Not end: 0, Success: 1, Fail: 2;
var lastState = new convnetjs.Vol(1, 1, 24, 0.0);
var lastAction = 0;
var lastReward = 0;
var thisAction = 0;
var episode = 0;
var gamma = 0.6;
var testFlag = false;
var eps = 0.7;

//end NN

var GameState = function(game) {
};

GameState.prototype.preload = function() {
    this.game.load.spritesheet('ship', 'assets/ship.png', 32, 32);
    this.game.load.image('terrain', 'assets/terrainblock.png');
    this.game.load.image('landzone', 'assets/landzone.png');
    this.game.load.spritesheet('explosion', 'assets/explosion.png', 128, 128);
    this.stage.disableVisibilityChange = true;
};

GameState.prototype.create = function() {
    this.stage.disableVisibilityChange = true;
    this.game.stage.backgroundColor = 0x333333;
    this.PLAYED = 0;
    this.SCORE = 0;
    this.FUEL = 150;
    this.ROTATION_SPEED = 180; // degrees/second
    this.ACCELERATION = 200; // pixels/second/second
    this.MAX_SPEED = 250; // pixels/second
    this.DRAG = 0; // pixels/second
    this.GRAVITY = 50; // pixels/second/second

    //Ship
    this.ship = this.game.add.sprite(0, 0, 'ship');
    this.ship.anchor.setTo(0.5, 0.5);
    this.ship.angle = -90; // Point the ship up
    this.game.physics.enable(this.ship, Phaser.Physics.ARCADE);
    this.ship.body.maxVelocity.setTo(this.MAX_SPEED, this.MAX_SPEED); // x, y
    this.ship.body.drag.setTo(this.DRAG, this.DRAG); // x, y
    game.physics.arcade.gravity.y = this.GRAVITY;
    this.ship.body.bounce.setTo(0.25, 0.25);
    this.resetScene();

    
    this.explosionGroup = this.game.add.group();

    this.game.input.keyboard.addKeyCapture([
        Phaser.Keyboard.LEFT,
        Phaser.Keyboard.RIGHT,
        Phaser.Keyboard.UP,
        Phaser.Keyboard.DOWN
    ]);
};


GameState.prototype.getExplosion = function() {

    var explosion = this.explosionGroup.getFirstDead();

    if (explosion === null) {
        explosion = this.game.add.sprite(0, 0, 'explosion');
        explosion.anchor.setTo(0.5, 0.5);

        var animation = explosion.animations.add('boom', [0,1,2,3], 60, false);
        animation.killOnComplete = true;

        this.explosionGroup.add(explosion);
    }

    explosion.revive();

    explosion.x = this.ship.x;
    explosion.y = this.ship.y;

    explosion.angle = this.game.rnd.integerInRange(0, 360);

    explosion.animations.play('boom');

    return explosion;
}

GameState.prototype.getDist = function(){
    return Math.sqrt(Math.pow((this.ship.x - (this.landzonePosition*8 + 32)), 2) + Math.pow((this.ship.y - (this.game.height - this.landzoneHeight*8)), 2));
};

GameState.prototype.getState = function(){

    var data = new convnetjs.Vol(1, 1, 24, 0.0);
    data.w[0] = this.ship.body.velocity.x;
    data.w[1] = this.ship.body.velocity.y;
    data.w[2] = this.ship.body.acceleration.x;
    data.w[3] = this.ship.body.acceleration.y;
    data.w[4] = this.ship.body.angularVelocity;
    data.w[5] = this.ship.rotation;
    data.w[6] = this.getDist();
    var grid = this.ship.x/8;
    var height = this.ship.y/8;
    var gridAll = [60, 60, 60, 60, 60, 60, 60, 60];

    for(var i = 0; i < this.terrainHeight.length; ++i) gridAll.push(this.terrainHeight[i]);
    for(var i = 0; i < 8; ++i) gridAll.push(60);
    var gridFinal = gridAll.slice(grid+8 -8, grid+8+8+1);
    for(var i = 0; i < gridFinal.length; ++i) gridFinal[i] -= height;
    for(var i = 0; i < 18; ++i) data.w[7+i] = gridFinal[i];  
    return data;
};

GameState.prototype.updateScore = function(flag) {
    this.PLAYED++;
    if(flag) this.SCORE++;
    document.getElementById("score").innerHTML = this.SCORE+'/'+this.PLAYED;
    document.getElementById("episode").innerHTML = ++episode;
};

GameState.prototype.showVelocity = function(vx, vy) {
    document.getElementById("vx").innerHTML = vx.toFixed(2);
    document.getElementById("vy").innerHTML = vy.toFixed(2);
    document.getElementById("fuel").innerHTML = this.FUEL;
    document.getElementById("reward").innerHTML = lastReward.toFixed(2);
    document.getElementById("action").innerHTML = thisAction;
    
};

GameState.prototype.resetScene = function() {
    // Move the ship back to the top of the stage
    this.ship.x = 32;
    this.ship.y = 32;
    this.ship.body.acceleration.setTo(0, 0);

    // Select a random starting angle and velocity
    this.ship.angle = this.game.rnd.integerInRange(-180, 180);
    this.ship.body.velocity.setTo(this.game.rnd.integerInRange(100, 200), 0);
    
    this.FUEL = 600;

    if(this.terrain)this.terrain.destroy();
    if(this.landzone)this.landzone.destroy();
    
    this.terrain = this.game.add.group();
    this.landzone = this.game.add.group();
    //Random terrain
    this.terrainHeight = [];

    for(var i = 0; i*8 < this.game.width; ++i){
        this.terrainHeight[i] = Math.floor(Math.random()*11 + 15);
    }

    //Landing zone platform
    this.landzonePosition = Math.floor(Math.random()*((this.game.width - 64)/8));
    this.landzoneHeight = Math.floor(Math.random()*21 + 1);

    for(var i = 0; i < 8; ++i){
        this.terrainHeight[this.landzonePosition + i] = this.landzoneHeight - 1;
    }

    for(var i = 0; i*8 < this.game.width; ++i){
        for(var j = 0; j < this.terrainHeight[i]; ++j){
            var terrainBlock = this.game.add.sprite(i*8, this.game.height-8*(j+1), 'terrain');
            this.game.physics.enable(terrainBlock, Phaser.Physics.ARCADE);
            terrainBlock.body.immovable = true;
            terrainBlock.body.allowGravity = false;
            this.terrain.add(terrainBlock);
        }
    }

    //Landing zone
    for(var i = 0; i < 8; ++i){
        var landzoneBlock = this.game.add.sprite((i+this.landzonePosition)*8, this.game.height-8*(this.landzoneHeight), 'landzone');
        this.game.physics.enable(landzoneBlock, Phaser.Physics.ARCADE);
        landzoneBlock.body.immovable = true;
        landzoneBlock.body.allowGravity = false;
        this.landzone.add(landzoneBlock);
    }
    lastState = this.getState();
};

GameState.prototype.checkLanding = function() {
    if(this.ship.body.touching.down) {
        if( Math.abs(this.ship.body.velocity.y) < 30
            && Math.abs(this.ship.body.velocity.x) < 30
            && Math.abs(Math.cos(this.ship.rotation)) < 0.2
        ){
            this.ship.body.angularVelocity = 0;
            this.ship.body.velocity.setTo(0, 0);
            this.ship.angle = -90;
            this.updateScore(true);
            endFlag = 1;
            this.resetScene();
        }else{
            this.getExplosion(this.ship.x, this.ship.y);
            this.updateScore(false);
            endFlag = 2;
            this.resetScene();
        }
    }
}

// The update() method is called every frame
GameState.prototype.update = function() {
    
    // Collide the ship with the ground
    var dist = this.getDist();
    lastReward = getReward(this.ship.body.velocity.x,
                            this.ship.body.velocity.y, 
                            this.ship.angle,
                            dist);
    this.showVelocity(this.ship.body.velocity.x, this.ship.body.velocity.y);
    
    this.game.physics.arcade.collide(this.ship, this.terrain, function() {
        this.getExplosion();
        this.updateScore(false);
        endFlag = 2;
        this.resetScene();

    }, null, this);
    this.game.physics.arcade.collide(this.ship, this.landzone, function(){
        this.checkLanding();
    }, null, this);
    
    if (this.ship.x > this.game.width || this.ship.x < 0 || this.FUEL <= 0){
        this.getExplosion();
        this.updateScore(false);
        endFlag = 2;
        this.resetScene();
    }

    //Rotation
    if (this.leftInputIsActive() || thisAction == 2) {
        this.ship.body.angularVelocity = -this.ROTATION_SPEED;
    } else if (this.rightInputIsActive() || thisAction == 3) {
        this.ship.body.angularVelocity = this.ROTATION_SPEED;
    } else {
        this.ship.body.angularVelocity = 0;
    }

    if (this.upInputIsActive() || thisAction == 1) {
        this.ship.body.acceleration.x = Math.cos(this.ship.rotation) * this.ACCELERATION;
        this.ship.body.acceleration.y = Math.sin(this.ship.rotation) * this.ACCELERATION;
        this.FUEL -= 1;
        this.ship.frame = 1;
    } else {
        this.ship.body.acceleration.setTo(0, 0);
        this.ship.frame = 0;
    }

 
    thisState = this.getState();

    thisAction = 0;
    approx = net.forward(thisState);
    max = -1e9;
    console.log(approx.w);
    if(!testFlag && Math.random() > eps){
        thisAction = Math.floor(Math.random()*4);
        max = approx.w[thisAction];
    }else{
        //argmax
        for(var a = 0; a < 4; ++a){
            if(approx.w[a] > max){
                thisAction = a;
                max = approx.w[a];
            }
        }
    }

    if(endFlag == 1){
        lastReward += 10;
    }
    if(endFlag == 2){
        lastReward -= 100;
    }

    trainSeq.push([lastState, lastAction, lastReward, max]);
    lastState = thisState;
    lastAction = thisAction;
    if(endFlag){

        while(trainSeq.length){
            var data = trainSeq.pop();
            var X = data[0];
            var Y = net.forward(data[0]);
            Y.w[data[1]] = data[2] + gamma*data[3];
            trainer.train(X, Y.w);
        }
        endFlag = 0;
    }

};

GameState.prototype.leftInputIsActive = function() {
    var isActive = false;

    isActive = this.input.keyboard.isDown(Phaser.Keyboard.LEFT);
    // isActive |= (this.game.input.activePointer.isDown &&
    //     this.game.input.activePointer.x < this.game.width/4);

    return isActive;
};

GameState.prototype.rightInputIsActive = function() {
    var isActive = false;

    isActive = this.input.keyboard.isDown(Phaser.Keyboard.RIGHT);
    // isActive |= (this.game.input.activePointer.isDown &&
    //     this.game.input.activePointer.x > this.game.width/2 + this.game.width/4);

    return isActive;
};

GameState.prototype.upInputIsActive = function() {
    var isActive = false;

    isActive = this.input.keyboard.isDown(Phaser.Keyboard.UP);
    // isActive |= (this.game.input.activePointer.isDown &&
    //     this.game.input.activePointer.x > this.game.width/4 &&
    //     this.game.input.activePointer.x < this.game.width/2 + this.game.width/4);

    return isActive;
};

var game = new Phaser.Game(848, 450, Phaser.AUTO, 'game');
game.state.add('game', GameState, true);