const path = require('path');

module.exports = {
    entry: './src/main.ts',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.(wgsl|vs|fs)$/,
                loader: 'ts-shader-loader'
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js'],
        fallback: {
            fs: false,
            path: false
        }
    },
    devServer: {
        static: {
            directory: path.resolve(__dirname, '.'),
        },
        hot: true,
        open: true,
    },
}