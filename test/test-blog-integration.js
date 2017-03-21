const chai = require('chai');
const chaiHTTP = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the should syntax available throughout
// this module
const should = chai.should();

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATSBASE_URL} = require('../config');

chai.use(chaiHTTP);

function seedBlogPostData() {
	console.info('seeding blogpost data');
	const seedData = [];

	for (let i=0; i<=10; i++) {
		seedData.push(generateBlogPostData());
	}
	//this will return a promise
	return BlogPost.insertMany(seedData);
}

// generate an object represnting a blogpost.
// can be used to generate seed data for db
// or request.body data
function generateBlogPostData() {
	return {
		author: {
		    firstName: faker.name.firstName(),
		    lastName: faker.name.lastName()
	  },
	  title: faker.lorem.sentence(),
	  content: faker.lorem.paragraph(),
	  created: Date.now
	}
}

// this function deletes the entire database.
// we'll call it in an `afterEach` block below
// to ensure  data from one test does not stick
// around for next one
function tearDownDb() {
	console.warn('Delteing database');
	return mongoose.connection.dropDatabase();
}

describe('Blogpost API resource', function() {
	// we need each of these hook functions to return a promise
  // otherwise we'd need to call a `done` callback. `runServer`,
  // `seedRestaurantData` and `tearDownDb` each return a promise,
  // so we return the value returned by these function calls.
  before(function() {
  	return runServer(TEST_DATSBASE_URL);
  });

  beforeEach(function() {
  	return seedBlogPostData();
  });

  afterEach(function() {
  	return tearDownDb();
  });

  after(function() {
  	return closeServer();
  })

  // note the use of nested `describe` blocks.
  // this allows us to make clearer, more discrete tests that focus
  // on proving something small

  describe('GET endpoint', function() {

  	it('should return all existing blogposts', function() {
  		// strategy:
      //    1. get back all blogposts returned by GET request to `/blogposts`
      //    2. prove res has right status, data type
      //    3. prove the number of blogposts we got back is equal to number
      //       in db.
      //
      // need to have access to mutate and access `res` across
      // `.then()` calls below, so declare it here so can modify in place
      let res;
      return chai.request(app)
      	.get('/blogposts')
      	.then(function(_res) {
      		//so subsequent .then blocks can access resp obj.
      		res =_res;
      		res.should.have.status(200);
      		//otherwise our db seeding didn't work
      		res.body.blogposts.should.have.length.of.at.least(1);
      		return BlogPost.count();
      	})
      	.then(function(count) {
      		res.body.blogposts.should.have.length.of(count);
      	});
  	});

  	it('should return blogposts with right fields', function() {
  		//Strategy: Get back all blogposts, and ensure they have expected keys

  		let resBlogpost;
  		return chai.request(app)
  			.get('/blogposts')
  			.then(function(res) {
  				re.should.have.status(200);
  				res.should.be.json;
  				res.body.blogposts.should.be.a('array');
  				res.body.blogposts.should.have.length.of.at.least(1);

  				res.body.blogposts.forEach(function(blogpost) {
  					blogpost.should.be.a('object');
  					blogpost.should.include.keys(
  						'id', 'author.firstName', 'author.lastName', 'title', 'content', 'created')
  				});
  				resBlogpost = res.body.blogposts[0];
  				return BlogPost.findById(resBlogpost.id);
  			})
  			.then(function(blogpost) {
  				resBlogpost.id.should.equal(blogpost.id);
  				resBlogpost.firstName.should.equal(blogpost.author.firstName);
  				resBlogpost.lastName.should.equal(blogpost.author.lastName);
  				resBlogpost.title.should.equal(blogpost.title);
  				resBlogpost.content.should.equal(blogpost.content);
  				resBlogpost.created.should.equal(blogpost.created);
  			});
  	});
  });

  describe('Post endpoint', function() {
  	// strategy: make a POST request with data,
    // then prove that the blogpost we get back has
    // right keys, and that `id` is there (which means
    // the data was inserted into db)
    it('should add a new blogpost', function() {

    	const newBlogpost = generateBlogPostData();

    	return chai.request(app)
    		.post('/blogposts')
    		.send(newBlogpost)
    		.then(function(res) {
    			res.should.have.status(201);
    			res.should.be.json;
    			res.body.should.be.a('object');
    			res.body.should.include.keys(
    				'id', 'author', 'title', 'content', 'created');
    			res.body.id.should.not.be.null;
    			res.body.title.should.equal(newBlogpost.title);
    			res.body.content.should.equal(newBlogpost.content);
    			return BlogPost.findById(res.body.id);
    		})
    		.then(function(blogpost) {
    			 blogpost.author.should.equal(newBlogpost.author);
    			 blogpost.title.should.equal(newBlogpost.title);
    			 blogpost.content.should.equal(newBlogpost.content);
    			 blogpost.created.should.equal(newBlogpost.created);
    		});
    });
  });

  describe('PUT endpoint', function() {
  	// strategy:
    //  1. Get an existing blogpost from db
    //  2. Make a PUT request to update that blogpost
    //  3. Prove blogpost returned by request contains data we sent
    //  4. Prove blogpost in db is correctly updated
    it('should update fields you send over', function() {
    	const updateData = {
    		title: 'PLEASE BE DIFFERENT',
    		content: 'PLEASE ALSO BE DIFFERENT'
    	};

    	return BlogPost
	    	.fincOne()
	    	.exec()
	    	.then(function(blogpost) {
	    		updateData.id = blogpost.id;
	    		// make request then inspect it to make sure it reflects
	        // data we sent
	        return chai.request(app)
	        	.put(`/blogpost/${blogpost.id}`)
	        	.send(updateData);
    	})
	    .then(function(res) {
	    	res.should.have.status(204);

	    	return BlogPost.findById(updateData.id).exec();
	    })
	    .then(function(blogpost) {
	    	blogpost.title.should.equal(updateData.title);
	    	blogpost.content.should.equal(updateData.content);
	    });
    });
  });

  describe('DELETE endpoint', function() {
  	// strategy:
    //  1. get a blogpost
    //  2. make a DELETE request for that blogpost's id
    //  3. assert that response has right status code
    //  4. prove that blogpost with the id doesn't exist in db anymore
    it('delete a blogpost by id', function() {

    	let blogpost;

    	return BlogPost
    		.fincOne()
    		.exec()
    		.then(function(_blogpost) {
    			blogpost = _blogpost;
    			return chai.request(app).delete(`/blogposts/${blogpost.id}`);
    		})
    		.then(function(res) {
    			res.should.have.status(204);
    			return BlogPost.findById(blogpost.id).exec();
    		})
    		.then(function(_blogpost) {
    			// when a variable's value is null, chaining `should`
          // doesn't work. so `_restaurant.should.be.null` would raise
          // an error. `should.be.null(_restaurant)` is how we can
          // make assertions about a null value.
          should.not.exist(_blogpost);
    		});
    });
  });
});









































