# Sentiment

![Sentiment](images/sentiment_node.png)

This node processes text and performs a sentiment analysis using the Natural Language APIs.  On invocation, it expects a string to be in `msg.payload` which contains the text that will be examined.  On return, the `msg.sentiment` object is filled in with two properties:

* msg.sentiment.score
* msg.sentiment.magnitude

The input text defaults to be English but this can be changed to one of the [supported](https://cloud.google.com/natural-language/docs/languages#sentiment_analysis) languages.