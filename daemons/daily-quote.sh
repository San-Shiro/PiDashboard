#!/bin/bash
# Daily quote daemon for PiDashboard
# Rotates through quotes hourly, writes to /tmp/widgets/quotes.json

OUTPUT="/tmp/widgets/quotes.json"
mkdir -p /tmp/widgets

# 55 curated quotes
QUOTES=(
  "The only way to do great work is to love what you do.|Steve Jobs"
  "Innovation distinguishes between a leader and a follower.|Steve Jobs"
  "Stay hungry, stay foolish.|Steve Jobs"
  "Life is what happens when you're busy making other plans.|John Lennon"
  "The future belongs to those who believe in the beauty of their dreams.|Eleanor Roosevelt"
  "It is during our darkest moments that we must focus to see the light.|Aristotle"
  "The best time to plant a tree was 20 years ago. The second best time is now.|Chinese Proverb"
  "An unexamined life is not worth living.|Socrates"
  "Turn your wounds into wisdom.|Oprah Winfrey"
  "The way to get started is to quit talking and begin doing.|Walt Disney"
  "If you look at what you have in life, you'll always have more.|Oprah Winfrey"
  "Life is either a daring adventure or nothing at all.|Helen Keller"
  "The mind is everything. What you think you become.|Buddha"
  "Strive not to be a success, but rather to be of value.|Albert Einstein"
  "The best revenge is massive success.|Frank Sinatra"
  "I have not failed. I've just found 10,000 ways that won't work.|Thomas Edison"
  "A person who never made a mistake never tried anything new.|Albert Einstein"
  "The only impossible journey is the one you never begin.|Tony Robbins"
  "Everything you've ever wanted is on the other side of fear.|George Addair"
  "Success is not final, failure is not fatal: it is the courage to continue that counts.|Winston Churchill"
  "Believe you can and you're halfway there.|Theodore Roosevelt"
  "What you get by achieving your goals is not as important as what you become.|Zig Ziglar"
  "The secret of getting ahead is getting started.|Mark Twain"
  "It always seems impossible until it's done.|Nelson Mandela"
  "Don't watch the clock; do what it does. Keep going.|Sam Levenson"
  "Everything has beauty, but not everyone sees it.|Confucius"
  "The purpose of our lives is to be happy.|Dalai Lama"
  "You miss 100% of the shots you don't take.|Wayne Gretzky"
  "Whether you think you can or you think you can't, you're right.|Henry Ford"
  "I think, therefore I am.|René Descartes"
  "The only limit to our realization of tomorrow is our doubts of today.|Franklin D. Roosevelt"
  "Do what you can, with what you have, where you are.|Theodore Roosevelt"
  "In the middle of every difficulty lies opportunity.|Albert Einstein"
  "It does not matter how slowly you go as long as you do not stop.|Confucius"
  "The greatest glory in living lies not in never falling, but in rising every time we fall.|Nelson Mandela"
  "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.|Ralph Waldo Emerson"
  "We are what we repeatedly do. Excellence, then, is not an act, but a habit.|Aristotle"
  "Imagination is more important than knowledge.|Albert Einstein"
  "Simplicity is the ultimate sophistication.|Leonardo da Vinci"
  "The only true wisdom is in knowing you know nothing.|Socrates"
  "Not all those who wander are lost.|J.R.R. Tolkien"
  "What we think, we become.|Buddha"
  "Happiness is not something ready made. It comes from your own actions.|Dalai Lama"
  "Be the change that you wish to see in the world.|Mahatma Gandhi"
  "The journey of a thousand miles begins with one step.|Lao Tzu"
  "That which does not kill us makes us stronger.|Friedrich Nietzsche"
  "You must be the change you wish to see in the world.|Mahatma Gandhi"
  "In three words I can sum up everything I've learned about life: it goes on.|Robert Frost"
  "To live is the rarest thing in the world. Most people exist, that is all.|Oscar Wilde"
  "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe.|Albert Einstein"
  "The best way to predict the future is to invent it.|Alan Kay"
  "Dream big and dare to fail.|Norman Vaughan"
  "Quality is not an act, it is a habit.|Aristotle"
  "Well done is better than well said.|Benjamin Franklin"
  "The only thing we have to fear is fear itself.|Franklin D. Roosevelt"
)

TOTAL=${#QUOTES[@]}

while true; do
  # Pick quote based on current hour (rotates daily through all quotes)
  HOUR=$(date +%H)
  DAY=$(date +%j)  # Day of year for variety
  INDEX=$(( (10#$DAY * 24 + 10#$HOUR) % TOTAL ))

  ENTRY="${QUOTES[$INDEX]}"
  TEXT="${ENTRY%%|*}"
  AUTHOR="${ENTRY##*|}"

  # Escape for JSON
  TEXT_ESC=$(echo "$TEXT" | sed 's/"/\\"/g')
  AUTHOR_ESC=$(echo "$AUTHOR" | sed 's/"/\\"/g')

  cat > "$OUTPUT" <<EOF
{
  "text": "$TEXT_ESC",
  "author": "$AUTHOR_ESC",
  "index": $INDEX
}
EOF

  # Sleep until the next hour
  MINS_LEFT=$(( 60 - 10#$(date +%M) ))
  SECS_LEFT=$(( MINS_LEFT * 60 - 10#$(date +%S) ))
  if [ "$SECS_LEFT" -le 0 ]; then SECS_LEFT=60; fi

  sleep $SECS_LEFT
done
