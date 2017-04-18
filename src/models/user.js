import mongoose from 'mongoose';

var userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    firstname: {
        type: String
    },
    lastname: {
        type: String
    },
    likedRecipes: [{type : mongoose.Schema.ObjectId, ref : 'Recipe'}],
});

export default mongoose.model('User', userSchema);
