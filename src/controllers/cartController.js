const mongoose = require("mongoose")
const validation = require("../validator/validator")
const userModel = require("../models/userModel")
const productModel = require("../models/productModel")
const cartModel = require("../models/cartModel")

// Updates a cart by either decrementing the quantity of a product by 1 or deleting a product from the cart.
// - Get cart id in request body.
// - Get productId in request body.
// - Get key 'removeProduct' in request body. 
// - Make sure that cart exist.
// - Key 'removeProduct' denotes whether a product is to be removed({removeProduct: 0}) or its quantity has to be decremented by 1({removeProduct: 1}).
// - Make sure the userId in params and in JWT token match.
// - Make sure the user exist
// - Get product(s) details in response body.
// - Check if the productId exists and is not deleted before updating the cart.
///users/:userId/cart 

const removeProduct = async function (req, res) {
    try {
        if (!validation.validBody(req.body)) return res.status(400).send({ status: false, msg: "Bad req Body" })
        let userId = req.params.userId
        if (!validation.validObjectId(userId)) return res.status(400).send({ status: false, msg: "Bad ObjectId in params" })

        let userExist = await userModel.findById({ _id: userId })
        if (!userExist) return res.status(400).send({ status: false, msg: "User Does Not Exist" })

        let { cartId, productId, removeProduct } = req.body

        if (!validation.isValid(cartId) || !validation.isValid(productId) || !validation.isValid(removeProduct)) return res.status(400).send({ status: false, msg: "Bad fields for request body, missing or Invalid fields" })

        if (!(removeProduct == '0' || removeProduct == '1')) return res.status(400).send({ status: false, msg: "Bad field for removeProduct" })
        removeProduct = Number(removeProduct)

        if (!validation.validObjectId(cartId)) return res.status(400).send({ status: false, msg: "Bad ObjectId for cartId" })
        if (!validation.validObjectId(productId)) return res.status(400).send({ status: false, msg: "Bad ObjectId for ProductId" })

        let cartExists = await cartModel.findById({ _id: cartId })
        if (!cartExists) return res.status(400).send({ status: false, msg: "Cart Does Not Exist" })

        let productExists = await productModel.findOne({ _id: productId, isDeleted: false })
        if (!productExists) return res.status(400).send({ status: false, msg: "Prduct Does not Exists" })

        if (cartExists.userId.toString() !== req.params.userId) return res.status(400).send({ status: false, msg: "Params userId does not match with the userId inside of Cart" })

        if (removeProduct == 0) {
            let flag
            let quantity; let totalPrice;
            let itemsArr = await cartModel.findById({ _id: cartId })
            if (itemsArr) {
                for (let i = 0; i < cartExists.items.length; i++) {
                    if (cartExists.items[i].productId.toString() == productId) {
                        flag = 1
                        quantity = cartExists.items[i].quantity
                    }
                }
                if (flag !== 1) return res.status(400).send({ status: false, msg: "Deleted or does not Exists" })


                totalPrice = cartExists.totalPrice
                totalPrice -= (productExists.price * quantity)
                let newCart = await cartModel.findOneAndUpdate({ _id: cartId }, { $pull: { items: { productId: productId } }, $set: { totalPrice: totalPrice }, $inc: { totalItems: -1 } }, { new: true }).populate({
                    path: 'items',
                    populate: {
                        path: 'productId',
                        model: 'Product',
                        select: 'price title'
                    }
                })
                return res.status(200).send({ status: true, data: newCart })
            }
        }
        else if (removeProduct == 1) {

            let prodPrice = productExists.price;
            let flag
            let quantity;
            let totalPrice = cartExists.totalPrice
            totalPrice -= prodPrice
            for (let i = 0; i < cartExists.items.length; i++) {
                if (cartExists.items[i].productId.toString() == productId) {
                    flag = 1
                    quantity = cartExists.items[i].quantity
                }
            }
            if (flag !== 1) return res.status(400).send({ status: false, msg: "Deleted or does not Exists" })

            if (quantity > 1) {
                let newCart = await cartModel.findOneAndUpdate({ _id: cartId, 'items.productId': productId }, { $set: { totalPrice: totalPrice }, $inc: { 'items.$.quantity': -1 } }, { new: true }).populate({
                    path: 'items',
                    populate: {
                        path: 'productId',
                        model: 'Product',
                        select: 'price title'
                    }
                })
                return res.status(200).send({ status: true, data: newCart })
            }
            else if (quantity == 1) {
                totalPrice = cartExists.totalPrice
                totalPrice -= (productExists.price * quantity)
                let newCart = await cartModel.findOneAndUpdate({ _id: cartId }, { $pull: { items: { productId: productId } }, $set: { totalPrice: totalPrice }, $inc: { totalItems: -1 } }, { new: true }).populate({
                    path: 'items',
                    populate: {
                        path: 'productId',
                        model: 'Product',
                        select: 'price title'
                    }
                })
                return res.status(200).send({ status: true, data: newCart })
            }

        }



    } catch (err) {
        return res.status(500).send({ status: false, msg: err.message })
    }
}


// ### POST /users/:userId/cart (Add to cart)
// - Create a cart for the user if it does not exist. Else add product(s) in cart.
// - Get cart id in request body.
// - Get productId in request body.
// - Make sure that cart exist.
// - Add a product(s) for a user in the cart.
// - Make sure the userId in params and in JWT token match.
// - Make sure the user exist
// - Make sure the product(s) are valid and not deleted.
// - Get product(s) details in response body.


const postCart = async function (req, res) {
    try {
        let data = req.body
        if (!validation.validBody(req.body)) return res.status(400).send({ status: false, msg: "Invalid or Empty Body" })
        if (req.body.cartId == undefined) {
            if (req.body.productId) {
                if (!validation.validObjectId(req.body.productId)) return res.status(400).send({ status: false, msg: "Invalid or missing productId" })
                let validProdId = await productModel.findOne({ _id: data.productId, isDeleted: false })
                if (!validProdId) return res.status(400).send({ status: false, msg: "ProductId Invalid or Product Deleted" })
                if (!validation.validObjectId(req.params.userId)) return res.status(400).send({ status: false, msg: "UserID in params not Valid" })

                let cartExists = await cartModel.findOne({ userId: req.params.userId })
                if (cartExists) return res.status(400).send({ status: false, msg: "Cart Created for this user, Please enter the cartId" })

                data.items = []


                if (data?.quantity) {
                    if (!validation.isValid(data.quantity)) return res.status(400).send({ status: false, msg: "quantity field Invalid" })
                    if (!/^[0-9]+$/.test(data.quantity)) return res.status(400).send({ status: false, msg: "quantity field Invalid" })
                    data.quantity = Number(data.quantity)

                }
                data.items.push({ productId: data.productId, quantity: data.quantity ?? 1 })

                let prodPrice = await productModel.findById({ _id: data.productId }).select({ _id: 0, price: 1 })

                data.totalPrice = prodPrice.price * (data.quantity ?? 1)
                data.totalItems = 1

                data.userId = req.params.userId

                let cartCreated = await cartModel.create(data)
                res.status(201).send({ status: true, data: cartCreated })
            } else {
                return res.status(400).send({ status: false, msg: "Missing productId" })
            }
        }
        else {
            if (!validation.validObjectId(req.body.productId)) return res.status(400).send({ status: false, msg: "Invalid or missing productId" })
            let validProdId = await productModel.findOne({ _id: data.productId, isDeleted: false })
            if (!validProdId) return res.status(400).send({ status: false, msg: "ProductId Invalid or Product Deleted" })
            if (!validation.validObjectId(req.params.userId)) return res.status(400).send({ status: false, msg: "UserID in params not Valid" })
            if (!validation.validObjectId(req.body.cartId)) return res.status(400).send({ status: false, msg: "CartId is Invalid" })

            if (data?.quantity) {
                if (!validation.isValid(data.quantity)) return res.status(400).send({ status: false, msg: "quantity field Invalid" })
                if (!/^[0-9]+$/.test(data.quantity)) return res.status(400).send({ status: false, msg: "quantity field Invalid" })
                data.quantity = Number(data.quantity)

            }
            let cartExist = await cartModel.findById({ _id: data.cartId })
            if (!cartExist) return res.status(400).send({ status: false, msg: "Cart does not exist" })

            let cartExists = await cartModel.findById({ _id: data.cartId })
            if (cartExists.userId.toString() !== req.params.userId) return res.status(400).send({ status: false, msg: "Params userId does not match with the userId inside of Cart" })


            let flag = 0

            let cartDetails = await cartModel.findById({ _id: data.cartId })
            for (let i = 0; i < cartDetails.items.length; i++) {
                if (cartDetails.items[i].productId?.toString() == data.productId) {
                    flag = 1
                    let prodPrice = await productModel.findById({ _id: data.productId }).select({ _id: 0, price: 1 })

                    if (data?.quantity) data.quantity = Number(data.quantity)
                    else data.quantity = 1
                    data.totalPrice = data.quantity * prodPrice.price
                    data.totalPrice += cartDetails.totalPrice
                    let updateCart = await cartModel.findOneAndUpdate({ _id: data.cartId, 'items.productId': data.productId }, { $set: { totalPrice: data.totalPrice }, $inc: { 'items.$.quantity': data.quantity } }, { new: true })

                    return res.status(200).send({ status: true, msg: updateCart })


                }
            }
            if (flag !== 1) {
                if (data?.quantity) data.quantity = Number(data.quantity)
                let prodPrice = await productModel.findById({ _id: data.productId }).select({ _id: 0, price: 1 })
                data.totalPrice = prodPrice.price * (data.quantity ?? 1)
                data.totalPrice += cartDetails.totalPrice
                let newProd = { productId: data.productId, quantity: data.quantity ?? 1 }
                let updateCart = await cartModel.findOneAndUpdate({ _id: data.cartId }, { $push: { items: newProd }, $set: { totalPrice: data.totalPrice }, $inc: { totalItems: 1 } }, { new: true })
                return res.status(200).send({ status: false, data: updateCart })
            }



        }


    } catch (e) {
        return res.status(500).send({ status: false, msg: e.message })
    }
}

// ### GET /users/:userId/cart
// - Returns cart summary of the user.
// - Make sure that cart exist.
// - Make sure the userId in params and in JWT token match.
// - Make sure the user exist
// - Get product(s) details in response body.

const getCart = async function (req, res) {
    try {
        let userId = req.params.userId
        if (!validation.validObjectId(userId)) return res.status(400).send({ status: false, msg: "userId not valid ObjectId" })

        let userExist = await userModel.findById({ _id: userId })
        if (!userExist) return res.status(400).send({ status: false, msg: "User does not Exists" })

        let cartExist = await cartModel.findOne({ userId: userId }).populate({
            path: 'items',
            populate: {
                path: 'productId',
                model: 'Product',
                select: 'title price'
            }
        })
        if (!cartExist) return res.status(400).send({ status: false, msg: "Cart does not Exists for this particular User" })

        return res.status(200).send({ status: true, msg: cartExist })

    } catch (error) {
        return res.status(500).send({ status: false, msg: error.message })
    }
}


// ### DELETE /users/:userId/cart
// - Deletes the cart for the user.
// - Make sure that cart exist.
// - Make sure the userId in params and in JWT token match.
// - Make sure the user exist
// - cart deleting means array of items is empty, totalItems is 0, totalPrice is 0.

const deleteCart = async function (req, res) {
    try {
        let userId = req.params.userId
        if (!validation.validObjectId(userId)) return res.status(400).send({ status: false, msg: "UserId invalid type" })

        let userExist = await userModel.findById({ _id: userId })
        if (!userExist) return res.status(400).send({ status: false, msg: "User does not Exists" })

        let cartExist = await cartModel.findOne({ userId: userId })
        if (!cartExist) return res.status(400).send({ status: false, msg: "Cart does not Exists for this particular User" })

        let deletedCart = await cartModel.findOneAndUpdate({userId : userId},{items : [], totalItems : 0, totalPrice : 0}, {new : true})
        return res.status(200).send({status : true, msg : deletedCart})
    }
    catch (error) {
        return res.status(500).send({ status: false, msg: error.message })
    }
}


module.exports = { postCart, removeProduct, getCart, deleteCart }