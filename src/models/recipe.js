import mongoose from 'mongoose';

var recipeSchema = new mongoose.Schema({
    author: {type : mongoose.Schema.ObjectId, ref : 'User'},
    title: {
        type: String,
        default: 'New Recipe',
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    steps: [{
        type: String,
    }],
    ingredients: [{
        type: String
    }]
});

export default mongoose.model('Recipe', recipeSchema);
