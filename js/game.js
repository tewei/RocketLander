//Alexander Shieh, 2015
//Adapted from John Watson, 2014
//Licensed under the terms of the MIT License


var GameState = function(game) {
};
GameState.prototype.getDist = function(){
    return Math.sqrt(Math.pow((this.ship.x - (this.landzonePosition*8 + 32)), 2) + Math.pow((this.ship.y - (this.game.height - this.landzoneHeight*8)), 2));
}
GameState.prototype.preload = function() {
    this.game.load.spritesheet('ship', 'assets/ship.png', 32, 32);
    this.game.load.image('terrain', 'assets/terrainblock.png');
    this.game.load.image('landzone', 'assets/landzone.png');
    this.game.load.spritesheet('explosion', 'assets/explosion.png', 128, 128);
};

GameState.prototype.create = function() {
    
    this.game.stage.backgroundColor = 0x333333;
    this.PLAYED = 0;
    this.SCORE = 0;
    this.FUEL = 600;
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
};

GameState.prototype.updateScore = function(flag) {
    this.PLAYED++;
    if(flag) this.SCORE++;
    document.getElementById("score").innerHTML = this.SCORE+'/'+this.PLAYED;
}

GameState.prototype.showVelocity = function(vx, vy) {
    document.getElementById("vx").innerHTML = vx.toFixed(2);
    document.getElementById("vy").innerHTML = vy.toFixed(2);
    document.getElementById("fuel").innerHTML = this.FUEL;
}

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
    var terrainHeight = [];

    for(var i = 0; i*8 < this.game.width; ++i){
        terrainHeight[i] = Math.floor(Math.random()*11 + 15);
    }

    //Landing zone platform
    this.landzonePosition = Math.floor(Math.random()*((this.game.width - 64)/8));
    this.landzoneHeight = Math.floor(Math.random()*21 + 1);

    for(var i = 0; i < 8; ++i){
        terrainHeight[this.landzonePosition + i] = this.landzoneHeight - 1;
    }

    for(var i = 0; i*8 < this.game.width; ++i){
        for(var j = 0; j < terrainHeight[i]; ++j){
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


};

GameState.prototype.checkLanding = function() {
    if(this.ship.body.touching.down) {
        if( Math.abs(this.ship.body.velocity.y) < 30
            && Math.abs(this.ship.body.velocity.x) < 30
            && Math.abs(Math.cos(this.ship.rotation)) < 0.2
        ) {
            this.ship.body.angularVelocity = 0;
            this.ship.body.velocity.setTo(0, 0);
            this.ship.angle = -90;
            this.updateScore(true);
            this.resetScene();
        }else{
            this.getExplosion(this.ship.x, this.ship.y);
            this.updateScore(false);
            this.resetScene();
        }
    }
}

// The update() method is called every frame
GameState.prototype.update = function() {
    var dist = this.getDist();
    console.log(dist);
    this.showVelocity(this.ship.body.velocity.x, this.ship.body.velocity.y);
    // Collide the ship with the ground
    this.game.physics.arcade.collide(this.ship, this.terrain, function() {
        this.getExplosion();
        this.resetScene();
        this.updateScore(false);
    }, null, this);
    this.game.physics.arcade.collide(this.ship, this.landzone, function(){
        this.checkLanding();
    }, null, this);
    
    if (this.ship.x > this.game.width || this.ship.x < 0 || this.FUEL <= 0){
        this.getExplosion();
        this.updateScore(false);
        this.resetScene();
    }

    //Rotation
    if (this.leftInputIsActive()) {
        this.ship.body.angularVelocity = -this.ROTATION_SPEED;
    } else if (this.rightInputIsActive()) {
        this.ship.body.angularVelocity = this.ROTATION_SPEED;
    } else {
        this.ship.body.angularVelocity = 0;
    }

    if (this.upInputIsActive()) {
        this.ship.body.acceleration.x = Math.cos(this.ship.rotation) * this.ACCELERATION;
        this.ship.body.acceleration.y = Math.sin(this.ship.rotation) * this.ACCELERATION;
        this.FUEL -= 1;
        this.ship.frame = 1;
    } else {
        this.ship.body.acceleration.setTo(0, 0);
        this.ship.frame = 0;
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