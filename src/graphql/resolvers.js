import User from '../models/user';
import Recipe from '../models/recipe';
import { find, filter } from 'lodash';
import rp from 'request-promise';

const nutri_app_id = 'ce0782cc';
const nutri_app_key = '556124a16f761ffd4945c32458291566';

const resolverMap = {
    Query: {
        users() {
            return User.find({});
        },
        user(_, {username}) {
            return User.findOne({'username': username});
        },
        recipes(author) {
            return Recipe.find({});
        },
        // recipe(_, {title}) {
        
        // },
        ingredient(_, {description}) {
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
                return {'description': description,
                        'calories': json_body.foods[0].nf_calories};
            });

        },
    },
    Mutation: {
        createUser(_, {username, password, firstname, lastname}) {
            var newUser = new User({username: username,
                                    password: password,
                                    firstname: firstname,
                                    lastname: lastname});
            var user = newUser.save();

            if (!user) {
                throw new Error(`Could not create user ${username}.`);
            }

            return user;
        },
        updateUser(_, {username, password, firstname, lastname}) {
            var user = User.findOneAndUpdate({username: username,
                                              password: password},
                                             {firstname: firstname,
                                              lastname: lastname});
            if (!user) {
                throw new Error(`User ${username} does not exist or password is incorrect.`);
            } else {
                return user;
            }
        },
        deleteUser(_, {username, password}) {
            var user = User.findOne({username: username,
                                     password: password});
            if (!user) {
                throw new Error(`User ${username} does not exist or password is incorrect.`);
            } else {
                user.remove();
            }
            return user;
        },
        createRecipe(_, {author, title, description, steps, ingredients}) {
            var result = User.findOne({username: author.username,
                                       password: author.password},
                                      (err, res) => {
                                          var recipe = new Recipe({author: res,
                                                                   title: title,
                                                                   description: description,
                                                                   steps: steps,
                                                                   ingredients: ingredients});
                                          return recipe.save();
                                      });
            
            return result;
        },
    },
    User: {
        recipes(author) {
            return Recipe.find({author: author});
        }
    },
    Recipe: {
        author(recipe) {
            return User.findOne(recipe.author);
        },
        ingredients(recipe) {
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
    },
    
};

export default resolverMap;
