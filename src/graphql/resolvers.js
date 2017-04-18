import User from '../models/user';
import Recipe from '../models/recipe';
import { find, filter } from 'lodash';
import rp from 'request-promise';
import Dropbox from 'dropbox';
import {generate} from 'password-hash';
import jwt from 'jsonwebtoken';
import DataLoader from 'dataloader';
import {nutri_app_id,
        nutri_app_key,
        dropbox_app_key,
        dropbox_redirect_uri,
        dropbox_access_token,
        secret_key,
        token_expiration} from '../config.js';

function getIngredient(description) {
    var options = {
        url: 'https://trackapi.nutritionix.com/v2/natural/nutrients',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-app-id': nutri_app_id,
            'x-app-key': nutri_app_key
        },
        form: {'query': description}
    }

    return rp(options).then(function (body) {
        var json_body = JSON.parse(body);
        var ingredients = json_body.foods.map((food) => {
                    return {'description': food.food_name,
                            'calories': food.nf_calories,
                            'totalfat': food.nf_total_fat,
                            'sugars': food.nf_sugars,
                            'serving': `${food.serving_qty} ${food.serving_unit}`};
        });
        if (ingredients.length == 1)
            return ingredients[0];
        else
            return ingredients;
    });
}

const ingredientLoader = new DataLoader(
    descriptions => Promise.all(descriptions.map(getIngredient))
);

const resolverMap = {
    Query: {
        users() {
            return User.find({});
        },
        user(_, {token}) {
            var payload = jwt.verify(token, secret_key);
            var credentials = payload.credentials;
            return User.findOne({'username': credentials.username});
        },
        recipes() {
            return Recipe.find({});
        },
        recipe(_, {title}) {
            return Recipe.findOne({'title': title});
        },
        ingredient(_, {description}) {
            return ingredientLoader.load(description);
        },
        loginurl() {
            var  dbx = new Dropbox();
            dbx.setClientId(dropbox_app_key);
            return dbx.getAuthenticationUrl(dropbox_redirect_uri);
        },
    },
    Mutation: {
        createUser(_, {username, password, firstname, lastname}) {
            var newUser = new User({username: username,
                                    password: generate(password),
                                    firstname: firstname,
                                    lastname: lastname});
            var user = newUser.save();

            if (!user) {
                throw new Error(`Could not create user ${username}.`);
            }

            return user;
        },
        loginUser(_, {username, password}) {
            var credentials = {username: username,
                               password: generate(password)};
            var user = User.findOne(credentials);

            if (!user) {
                throw new Error(`User ${username} does not exist or password is incorrect.`);
            } else {
                var token = jwt.sign({credentials}, secret_key, {expiresIn: token_expiration});
                return {token: token};
            }
        },
        updateUser(_, {username, password, firstname, lastname}) {
            var user = User.findOneAndUpdate({username: username,
                                              password: generate(password)},
                                             {firstname: firstname,
                                              lastname: lastname},
                                             {new: true});
            if (!user) {
                throw new Error(`User ${username} does not exist or password is incorrect.`);
            } else {
                return user;
            }
        },
        deleteUser(_, {username, password}) {
            var user = User.findOne({username: username,
                                     password: generate(password)});
            if (!user) {
                throw new Error(`User ${username} does not exist or password is incorrect.`);
            } else {
                user.remove();
            }
            return user;
        },
        createRecipe(_, {token, title, description, steps, ingredients}) {
            var payload = jwt.verify(token, secret_key);
            var credentials = payload.credentials;
            var user = User.findOne({username: credentials.username}, (err, user) => {
                var recipe = new Recipe({author: user,
                                         title: title,
                                         description: description,
                                         steps: steps,
                                         ingredients: ingredients});
                
                recipe.save();
            });
            return `Recipe "${title}" created successfully!`;
        },
    },
    User: {
        recipes(author) {
            return Recipe.find({author: author});
        },
        likedRecipes(user) {
            return Recipe.find({_id: {$in: user.likedRecipes}}).exec();
        },
    },
    Recipe: {
        author(recipe) {
            return User.findOne(recipe.author);
        },
        ingredients(recipe) {
            var ingredients = ingredientLoader.load(recipe.ingredients.join("\n"));
            console.log(ingredients);
            return ingredients;
            
            var query = recipe.ingredients.join("\n");
            var options = {
                url: 'https://trackapi.nutritionix.com/v2/natural/nutrients',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-app-id': nutri_app_id,
                    'x-app-key': nutri_app_key
                },
                form: {'query': query}
            };
            
            return rp(options).then(function (body) {
                var json_body = JSON.parse(body);
                console.log(json_body);
                var ingredients = json_body.foods.map((food) => {
                    return {'description': food.food_name,
                            'calories': food.nf_calories,
                            'totalfat': food.nf_total_fat,
                            'sugars': food.nf_sugars,
                            'serving': `${food.serving_qty} ${food.serving_unit}`};
                });
                console.log(ingredients);
                return ingredients;
            });
            
        },
        uploadRecipe(recipe) {
            
            var dbx = new Dropbox({accessToken: dropbox_access_token});
            dbx.setClientId(dropbox_app_key);

            dbx.filesUpload({path: `/${recipe.title}.txt`, contents: JSON.stringify(recipe)})
                .then(function(response) {
                    console.log(response);
                })
                .catch(function(error) {
                    console.error(error);
                });

            return `Recipe ${recipe.title} was uploaded to Dropbox!`;
        },
        likeRecipe(recipe, {token}) {
            var payload = jwt.verify(token, secret_key);
            var credentials = payload.credentials;
            var recipe_closure = recipe;

            var user = User.findOneAndUpdate({username: credentials.username},
                                             {$addToSet: {likedRecipes: recipe_closure}},
                                             {new: true},
                                             (err, user) => {
                                                 Recipe.findOneAndUpdate({title: recipe_closure.title},
                                                                         {$addToSet: {'likedBy': user}},
                                                                         {new: true}, (err, recipe) => {
                                                                             if (err) {
                                                                                 throw new Error(`There was an error liking the recipe`);
                                                                             } else {
                                                                                 return "hola";
                                                                             }
                                                                         });
                                             });
            return recipe;
            
        },
        likedBy(recipe) {
            return User.find({_id: {$in: recipe.likedBy}}).exec();
        },
    },
    
};

export default resolverMap;
