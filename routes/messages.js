var express = require('express');
var router = express.Router();
let MessageModel = require('../schemas/messages');
let { CheckLogin } = require('../utils/authHandler');
let mongoose = require('mongoose');

router.get('/', CheckLogin, async function (req, res, next) {
  try {
    let currentUserId = mongoose.Types.ObjectId(req.user._id);
    let latestMessages = await MessageModel.aggregate([
      {
        $match: {
          $or: [
            { from: currentUserId },
            { to: currentUserId }
          ]
        }
      },
      {
        $addFields: {
          correspondent: {
            $cond: [
              { $eq: ['$from', currentUserId] },
              '$to',
              '$from'
            ]
          }
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$correspondent',
          lastMessage: { $first: '$$ROOT' }
        }
      },
      { $replaceRoot: { newRoot: '$lastMessage' } }
    ]);

    await MessageModel.populate(latestMessages, [
      { path: 'from', select: 'username fullName avatarUrl' },
      { path: 'to', select: 'username fullName avatarUrl' }
    ]);

    res.send(latestMessages);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get('/:id', CheckLogin, async function (req, res, next) {
  try {
    let currentUserId = mongoose.Types.ObjectId(req.user._id);
    let otherUserId = mongoose.Types.ObjectId(req.params.id);

    let messages = await MessageModel.find({
      $or: [
        { from: currentUserId, to: otherUserId },
        { from: otherUserId, to: currentUserId }
      ]
    })
      .sort({ createdAt: 1 })
      .populate('from', 'username fullName avatarUrl')
      .populate('to', 'username fullName avatarUrl');

    res.send(messages);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/', CheckLogin, async function (req, res, next) {
  try {
    let { to, messageContent } = req.body;
    if (!to || !messageContent || !messageContent.type || !messageContent.text) {
      return res.status(400).send({ message: 'Yêu cầu đầy đủ thông tin: to, messageContent.type, messageContent.text' });
    }

    if (!['file', 'text'].includes(messageContent.type)) {
      return res.status(400).send({ message: 'messageContent.type phải là file hoặc text' });
    }

    let newMessage = new MessageModel({
      from: req.user._id,
      to,
      messageContent: {
        type: messageContent.type,
        text: messageContent.text
      }
    });

    let result = await newMessage.save();
    result = await result
      .populate('from', 'username fullName avatarUrl')
      .populate('to', 'username fullName avatarUrl');

    res.send(result);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;
