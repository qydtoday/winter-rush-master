/**
	Winter Rush Game
	Handles track, trees, motion, hit detection
	by Felix Turner / @felixturner / www.airtight.cc
**/

var WRGame = function() {

	var ACCEL = 2000;
	var MAX_SPEED_ACCEL = 70;
	var START_MAX_SPEED = 1500;
	var FINAL_MAX_SPEED = 7000;
	var SIDE_ACCEL = 500;
	var MAX_SIDE_SPEED = 4000;
	var TREE_COLS = [0x466310,0x355B4B,0x449469];
	var TREE_COUNT = 10;
	var FLOOR_RES = 20;
	var FLOOR_YPOS = -300;
	var FLOOR_THICKNESS = 300;

	var stepCount = 0;
	var moveSpeed = 0; //z distance per second
	var maxSpeed; 		//increments over time
	var slideSpeed = 0;
	
	var slideSpeedy = 0;	/////////~~~~~~~~~~~增加7
	
	var sliding = false;

	var rightDown = false;
	var leftDown = false;
	
	var UPDown = false;			/////////~~~~~~~~~~~增加3
	var DOWNDown = false;
	
	var playing = false;
	var acceptInput = true;
	var clock;

	var trees = [];

	var noiseScale = 3;
	var noiseSeed = Math.random() * 100;

	var moverGroup;
	var presentGroup;
	var floorGeometry;
	var treeMaterials;
	var trunkMaterial;
	var treeGeom;
	var trunkGeom;
	
	var snoise = new ImprovedNoise();

	function init(){	//光照，地面生成设置，场景布置

		clock = new THREE.Clock();

		//lights
		//HemisphereLight(skyColorHex, groundColorHex, intensity)
		var hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x000000, 0.6);
		WRMain.getScene().add( hemisphereLight );
		hemisphereLight.position.y = 300;

		//middle light
		var centerLight = new THREE.PointLight( 0xFFFFFF, 0.8, 4500 );
		WRMain.getScene().add(centerLight);
		centerLight.position.z = WRConfig.FLOOR_DEPTH/4;
		centerLight.position.y = 500;

		var frontLight = new THREE.PointLight( 0xFFFFFF, 1, 2500 );
		WRMain.getScene().add(frontLight);
		frontLight.position.z = WRConfig.FLOOR_DEPTH/2;

		moverGroup = new THREE.Object3D();
		WRMain.getScene().add( moverGroup );

		//make floor
		var floorGroup = new THREE.Object3D();

		var floorMaterial = new THREE.MeshLambertMaterial({			//这种材质可以用来创建暗淡的并不光亮的表面
			color: 0xCCCCCC, //diffuse							
			emissive: 0x000000, 
			shading: THREE.FlatShading, 
			side: THREE.DoubleSide,
		});

		//add extra x width
		floorGeometry = new THREE.PlaneGeometry( WRConfig.FLOOR_WIDTH + 1200, WRConfig.FLOOR_DEPTH , FLOOR_RES,FLOOR_RES );
		var floorMesh = new THREE.Mesh( floorGeometry, floorMaterial );
		floorGroup.add( floorMesh );
		moverGroup.add( floorGroup );
		floorMesh.rotation.x = Math.PI/2;
		//floorMesh.rotation.z = Math.PI/2;
		floorGroup.position.y = FLOOR_YPOS;
		moverGroup.position.z = - WRConfig.MOVE_STEP;
		floorGroup.position.z = 500;

		//make trees
		var i;
		treeMaterials = [];

		for(  i= 0; i < TREE_COLS.length; i++) {

			var treeMaterial = new THREE.MeshLambertMaterial({
				color: TREE_COLS[i],				
				shading: THREE.FlatShading, 
				depthTest: true,						
			});
			treeMaterials.push(treeMaterial);
		}

		trunkMaterial = new THREE.MeshLambertMaterial({
				color: 0x330000, 					
				shading: THREE.FlatShading, 
				blending: THREE.NormalBlending, 
				depthTest: true,
				transparent: false,
				opacity: 1.0,
			});

		trunkGeom = new THREE.CylinderGeometry(25, 50, 750, 8, 1, false);	//树的躯干和枝叶
		//treeGeom = new THREE.CylinderGeometry(0, 250, 1200, 8, 1, false);
		//treeGeom = new THREE.SphereGeometry(200,100,100);			
		treeGeom = new THREE.TetrahedronGeometry(250, 2);
		
		var tree;
		for( i = 0; i < TREE_COUNT; i++) {

			var scl = ATUtil.randomRange(0.8,1.3);
			var matID = i%TREE_COLS.length;
			
			tree = makeTree(scl,matID);			//生成树
			
			moverGroup.add( tree );
			
			tree.posi = Math.random();		//随机坐标
			tree.posj = Math.random();
			tree.position.x = tree.posj * WRConfig.FLOOR_WIDTH - WRConfig.FLOOR_WIDTH/2;
			tree.position.z = - (tree.posi * WRConfig.FLOOR_DEPTH) + WRConfig.FLOOR_DEPTH/2;
			tree.rotation.y = Math.random()*Math.PI*2;		//随机绕Y轴转一定角度
			trees.push(tree);
			tree.collided = false;
		}

		//add trees down the edges 两边的树
		var EDGE_TREE_COUNT = 12;
		for( i = 0; i < EDGE_TREE_COUNT; i++) {
			tree = makeTree(1.3,0);
			moverGroup.add( tree );
			tree.position.x = WRConfig.FLOOR_WIDTH/2 + 300;
			tree.position.z = WRConfig.FLOOR_DEPTH * i/EDGE_TREE_COUNT -  WRConfig.FLOOR_DEPTH/2;

		}

		for( i = 0; i < EDGE_TREE_COUNT; i++) {
			tree = makeTree(1.3,0);
			moverGroup.add( tree );
			tree.position.x = -(WRConfig.FLOOR_WIDTH/2 + 300);
			tree.position.z = WRConfig.FLOOR_DEPTH * i/EDGE_TREE_COUNT -  WRConfig.FLOOR_DEPTH/2;
		}



		//add floating present
		presentGroup = new THREE.Object3D();
		moverGroup.add( presentGroup );			//宝石group加入总的group

		presentGroup.position.x = ATUtil.randomRange(-WRConfig.FLOOR_WIDTH/2, WRConfig.FLOOR_WIDTH/2);
		presentGroup.position.z = ATUtil.randomRange(-WRConfig.FLOOR_DEPTH/2, WRConfig.FLOOR_DEPTH/2);
		
		//presentGroup.position.y = 1000;		//高度

		var presentMaterial = new THREE.MeshPhongMaterial({		//设置宝石的材质
			color: 0x7777ff, 
			specular: 0x00FFFF, 
			emissive: 0x0000FF, 
			shininess: 60, 
			shading: THREE.FlatShading, 
			blending: THREE.NormalBlending, 
			depthTest: true,
			transparent: false,
			opacity: 1.0		
		});

		//var presentGeom = new THREE.TetrahedronGeometry(100, 2);
		
		var present = new THREE.Object3D();
		var presentGeomButtom = new THREE.CylinderGeometry(0, 50, 75, 8, 2, false);
		var presentGeomTop = new THREE.CylinderGeometry(30, 50, 25, 8, 2, false);

		//var present1 = new THREE.Mesh( presentGeomButton, presentMaterial );	//创建模型

		var present1 = new THREE.Mesh( presentGeomButtom, presentMaterial );
		var present2 = new THREE.Mesh( presentGeomTop, presentMaterial );	
		present.add(present1);
		present.add(present2);
		
		present2.rotation.x = Math.PI;
		present2.position.y = -50;
		
		presentGroup.add( present );
	
		
////////////////////////////////////////////

		//PointLight(hex, intensity, distance)
		var presentLight = new THREE.PointLight( 0x7777ff, 1.2, 600 );
		presentGroup.add( presentLight );

		presentGroup.collided = false;

		
		WRSnow.init();			//雪的初始化

		setFloorHeight();

		resetField();

		clock.start();
		maxSpeed = START_MAX_SPEED;

	}

	function makeTree(scale,materialID){		//生成树

		var tree = new THREE.Object3D();
		var branches = new THREE.Mesh( treeGeom, treeMaterials[materialID] );	//生成模型，treeGeom在上面定义
		var trunk =   new THREE.Mesh( trunkGeom, trunkMaterial );
		tree.add( branches );
		tree.add( trunk );
		branches.position.y = -200;
		trunk.position.y =  -700;
		tree.scale.x = tree.scale.z = tree.scale.y = scale; 
		tree.myheight = 1400 * tree.scale.y;
		//put tree on floor
		tree.position.y =  tree.myheight/2 - 300;
		return tree;
	}

	function setFloorHeight(){ 

		//apply noise to floor
		
		//move mover back by WRConfig.MOVE_STEP
		stepCount++;
		moverGroup.position.z = - WRConfig.MOVE_STEP;	//z distance to move before recreating a new floor strip

		//calculate vert psons base on noise
		var i;
		var ipos;
		var offset = stepCount *WRConfig.MOVE_STEP/WRConfig.FLOOR_DEPTH * FLOOR_RES;

		for( i = 0; i < FLOOR_RES + 1; i++) {
			for( var j = 0; j < FLOOR_RES + 1; j++) {
				ipos = i + offset;
				floorGeometry.vertices[i * (FLOOR_RES + 1)+ j].z = snoise.noise(ipos/FLOOR_RES * noiseScale, j/FLOOR_RES * noiseScale, noiseSeed ) * FLOOR_THICKNESS;
			}
		}
		floorGeometry.verticesNeedUpdate = true;

		for(  i = 0; i < TREE_COUNT; i++) {

			var tree = trees[i];
			tree.position.z +=WRConfig.MOVE_STEP;	//树的位置往前移

			if (tree.position.z + moverGroup.position.z > WRConfig.FLOOR_DEPTH/2){

				tree.collided = false;
				tree.position.z	-= WRConfig.FLOOR_DEPTH;
				ipos = tree.posi + offset/FLOOR_RES * WRConfig.FLOOR_DEPTH;
				//re-randomize x pos
				tree.posj = Math.random();
				tree.position.x = tree.posj * WRConfig.FLOOR_WIDTH - WRConfig.FLOOR_WIDTH/2;
				tree.visible = true;
			}			 

		}

		WRSnow.shift();

		//shift present
		presentGroup.position.z += WRConfig.MOVE_STEP;		//宝石相对移动
		if (presentGroup.position.z + moverGroup.position.z > WRConfig.FLOOR_DEPTH/2){	//宝石位置往前移
			presentGroup.collided = false;
			presentGroup.position.z	-= WRConfig.FLOOR_DEPTH;
			//re-randomize x pos
			presentGroup.posj = Math.random();
			var xRange = WRConfig.FLOOR_WIDTH/2 * 0.7;
			presentGroup.position.x = ATUtil.randomRange(-xRange,xRange);	//随机位置
			
			//var randomnum = Math.floor(Math.random()*10+1);		///////////~~~~~~~~生成1~10的随机整数
			if(WRMain.getCamera().position.y <= 500)
			{
				presentGroup.position.y = 1000;		//高度
			}else{
				presentGroup.position.y = 0;
			}
			
		
		}		

	}

	function animate() {


		
		
		var i;

		var delta = clock.getDelta();	

		//PLAYER MOVEMENT
		if (playing){
		
			//max speed accelerates slowly
			maxSpeed += delta *MAX_SPEED_ACCEL;
			maxSpeed = Math.min(maxSpeed,FINAL_MAX_SPEED);

			//move speed accelerates quickly after a collision
			moveSpeed += delta *ACCEL;
			moveSpeed = Math.min(moveSpeed,maxSpeed);

			//right takes precedence
			if (rightDown){

				slideSpeed += SIDE_ACCEL;
				slideSpeed = Math.min(slideSpeed,MAX_SIDE_SPEED);

			} else if (leftDown){

				slideSpeed -= SIDE_ACCEL;
				slideSpeed = Math.max(slideSpeed,-MAX_SIDE_SPEED);
								
			}
			
			else if (UPDown){			/////////~~~~~~~~~~~增加4

				if(WRMain.getCamera().position.y < 1000)
				{
					WRMain.getCamera().position.y += 50;
				}else{
					WRMain.playCollide();
					WRMain.getCamera().position.y -= 50;
				}

			}else if (DOWNDown){

				if(WRMain.getCamera().position.y > 0)
				{
					WRMain.getCamera().position.y -= 50;
				}else{
					WRMain.playCollide();
					WRMain.getCamera().position.y += 50;
				}
			}
			
			
			else{
				slideSpeed *= 0.8;
			}

			//bounce off edges of rails
			var nextx = WRMain.getCamera().position.x + delta * slideSpeed;
		
			if (nextx > WRConfig.FLOOR_WIDTH/2 || nextx < -WRConfig.FLOOR_WIDTH/2){	//与两边的树发生碰撞时引发动画效果
				slideSpeed = -slideSpeed;
				WRMain.playCollide();
			}			

			WRMain.getCamera().position.x += delta * slideSpeed;

			//TILT
			//moverGroup.rotation.z = 0.016 * slideSpeed * 0.003;
			moverGroup.rotation.z = slideSpeed * 0.000038;

		}else{
			//slow down after dead
			moveSpeed *= 0.95;

		}

		presentGroup.rotation.x += 0.01;	//宝石旋转效果
		presentGroup.rotation.y += 0.02;

	

		moverGroup.position.z += delta * moveSpeed;

		if (moverGroup.position.z > 0){
			//build new strip
			setFloorHeight();
		}

		WRSnow.animate();
		
		//SIMPLE HIT DETECT

		if (WRConfig.hitDetect){

			var p;
			var dist;

			var camPos = WRMain.getCamera().position.clone();
			camPos.z -= 200;

			p = presentGroup.position.clone();
			p.add(moverGroup.position);
			dist = p.distanceTo(camPos);
			
			if (dist < 200 && !presentGroup.collided){
				//GOT POINT
				presentGroup.collided = true;
				WRMain.onScorePoint();
			}


			for(  i = 0; i < TREE_COUNT; i++) {

				p = trees[i].position.clone();
				p.y = 0; //ignore tree height
				p.add(moverGroup.position);

				//can only hit trees if they are in front of you
				if (p.z < camPos.z && p.z > camPos.z - 200){

					dist = p.distanceTo(camPos);
					if (dist < 200 && !trees[i].collided ){

						//GAME OVER
						trees[i].collided = true;
						onGameEnd();
					}		
				}
			}
		}

	}


	function startGame(isFirstGame){

		acceptInput = false;
		//if first game just start run
		if (isFirstGame){
			startRun();
			return;
		}

		//fade out
		TweenMax.fromTo(WRMain.fxParams,0.3,{brightness:0},{brightness:-1});
		TweenMax.delayedCall(0.3,resetField);
		TweenMax.fromTo(WRMain.fxParams,0.3,{brightness:-1},{brightness:0,delay:0.3});
		TweenMax.delayedCall(0.6,startRun);

	}

	function resetField(){
		
		var camPos = WRMain.getCamera().position;
		//put cam in middle
		camPos.x = 0;
		//set tilt to 0
		slideSpeed = 0;
		
		slideSpeedy = 0;					//////~~~~~~~~~~增加8
		
		moverGroup.rotation.z = 0;
		//kill trees that are too close at the start
		for(  i = 0; i < TREE_COUNT; i++) {
			p = trees[i].position.clone();
			p.add(moverGroup.position);

			if (p.z < camPos.z && p.z > camPos.z - WRConfig.FLOOR_DEPTH/2){
				trees[i].collided = true;
				trees[i].visible = false;
			}
		}

	}

	function startRun(){
		playing = true;
		acceptInput = true;
	}

	function onAcceptInput(){
	 	acceptInput = true;
	}

	function onGameEnd(){
		moveSpeed = -1200;
		maxSpeed = START_MAX_SPEED;
		playing = false;
		acceptInput = false;
		//wait before re-enabling start game
		TweenMax.delayedCall(1,onAcceptInput);
		WRMain.onGameOver();
	
	}

	return {
		init:init,
		startGame:startGame,
		animate:animate,
		setRightDown: function (b){rightDown = b;},
		setLeftDown: function (b){leftDown = b;},
		
		setUPDown: function (b){UPDown = b;},			/////////~~~~~~~~~~~增加2
		setDOWNDown: function (b){DOWNDown = b;},
		
		getPlaying: function (){return playing;},
		getMoverGroup:function (){return moverGroup;},
		getSpeed: function() {return moveSpeed/FINAL_MAX_SPEED;},
		resetField:resetField,
		getAcceptInput:function (){return acceptInput;},
	};


}();

