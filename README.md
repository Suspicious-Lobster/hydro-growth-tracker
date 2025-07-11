# 🌿 Hydro Growth Tracker v1.0.0

A comprehensive hydroponic plant growth tracking system with advanced features and professional-grade functionality.

## ✨ Recent Improvements

### 🎨 **UI/UX Enhancements**
- **Fixed text color issues**: Plant name inputs now use proper theme colors (no more grey text on white backgrounds)
- **Improved height input controls**: Added +/- buttons for precise height adjustments (±0.5 cm increments)
- **Better visual feedback**: All form inputs now have consistent styling with proper focus states

### 💾 **Draft Auto-Save Feature**
- **Automatic draft saving**: Form data is automatically saved to localStorage when typing
- **Draft restoration**: Unsaved changes are restored when you return to the form
- **Visual indicators**: Clear indication when a draft is saved with options to clear it
- **Data protection**: Browser warning when leaving with unsaved changes

### 📅 **Calendar Export System**
- **16-week feeding schedule**: Professional-grade feeding schedule with EC levels for each growth stage
- **Calendar integration**: Export CSV files compatible with Google Calendar, Outlook, and Apple Calendar
- **Detailed instructions**: Step-by-step guide for importing into different calendar applications
- **Complete feeding data**: Includes mixing ratios, growth stages, and professional notes

### 🔧 **Technical Improvements**
- **Modern theme system**: Consistent dark/light theme throughout the application
- **Improved accessibility**: Better contrast ratios and keyboard navigation
- **Mobile responsive**: Works seamlessly on all device sizes
- **Error handling**: Better error messages and user feedback

## 🚀 Features

### 📊 **Plant Management**
- Track multiple plants with individual growth logs
- Photo upload for visual progress tracking
- Comprehensive plant statistics and analytics
- Smart growth recommendations based on plant size and age

### 🍃 **Feeding Schedule**
- Intelligent feeding recommendations by growth stage
- Customizable nutrient schedules
- EC level tracking and suggestions
- Calendar export for feeding reminders

### 📈 **Analytics & Charts**
- Real-time growth charts with Recharts
- Growth rate calculations
- Trend analysis and projections
- Export data to CSV for external analysis

### 🎯 **Smart Recommendations**
- Growth stage detection (Seedling, Vegetative, Pre-Flowering, Flowering)
- Tailored feeding, pruning, and monitoring advice
- Nutrient calculator for precise mixing
- Task management with priority levels

## 🛠️ Installation

### Prerequisites
- Node.js 18+ (recommended)
- npm or yarn package manager
- 2GB RAM minimum
- 500MB disk space

### Quick Start
1. **Clone or download** the project
2. **Backend setup**:
   ```bash
   cd backend
   npm install
   npm start
   ```
3. **Frontend setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Production Build
```bash
# Build frontend
cd frontend
npm run build

# Start backend
cd ../backend
npm start
```

## 📱 Usage

### Adding Plant Logs
1. Navigate to "Add Log" tab
2. Fill in plant details (name, height, nutrients, notes)
3. Use +/- buttons for precise height measurements
4. Upload photos for visual tracking
5. Form auto-saves as you type (draft protection)

### Managing Feeding Schedules
1. Go to "Feeding Schedule" tab
2. Add feeding schedules for each plant
3. View intelligent recommendations based on growth stage
4. Export 16-week calendar for feeding reminders

### Exporting Calendar
1. Click "Export Calendar" in Feeding Schedule
2. Select your start date
3. Download the CSV file
4. Follow the provided instructions for your calendar app

## 🔧 Technical Details

### Frontend Stack
- **React 18**: Modern React with hooks and context
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Recharts**: React charting library
- **Lucide React**: Beautiful icon library

### Backend Stack
- **Node.js**: JavaScript runtime
- **Express**: Web framework
- **SQLite**: Lightweight database
- **Multer**: File upload handling
- **CORS**: Cross-origin resource sharing

### Data Storage
- **SQLite database**: Stores plant logs and feeding schedules
- **File system**: Stores uploaded images
- **localStorage**: Stores form drafts and user preferences

## 🎨 Themes

The application supports both dark and light themes:
- **Auto-detection**: Respects system theme preference
- **Manual toggle**: Theme switcher in top-right corner
- **Persistent**: Theme choice saved in localStorage
- **Smooth transitions**: Animated theme changes

## 📋 System Requirements

### Development
- Node.js 18+
- npm 8+
- Modern browser (Chrome, Firefox, Safari, Edge)

### Production
- Node.js 18+
- 2GB RAM minimum
- 500MB disk space
- Web server (optional for static hosting)

## 🔄 Updates & Changelog

### v1.0.0 (Current)
- ✅ Fixed text color issues in forms
- ✅ Added height adjustment controls (+/- buttons)
- ✅ Implemented draft auto-save functionality
- ✅ Added 16-week feeding schedule calendar export
- ✅ Improved theme consistency
- ✅ Enhanced mobile responsiveness
- ✅ Added comprehensive error handling

### Previous Versions
- v0.9.0: Basic plant tracking and feeding schedules
- v0.8.0: Added charts and analytics
- v0.7.0: Initial release with core functionality

## 📞 Support

### Common Issues
1. **Database not found**: Ensure backend is running and database is created
2. **Images not loading**: Check file permissions and upload directory
3. **Theme not working**: Clear browser cache and localStorage
4. **Draft not saving**: Check browser localStorage permissions

### Development
- Run `npm run lint` for code quality checks
- Run `npm run build` for production builds
- Check browser console for error messages

## 🎯 Future Enhancements

### Planned Features
- [ ] Multi-user support with authentication
- [ ] Advanced plant disease detection
- [ ] Integration with IoT sensors
- [ ] Mobile app version
- [ ] Cloud synchronization
- [ ] Advanced analytics and AI recommendations

### Technical Improvements
- [ ] Unit tests and integration tests
- [ ] Performance optimizations
- [ ] Database migrations
- [ ] Docker containerization
- [ ] CI/CD pipeline

## 📄 License

This project is for educational and personal use. Feel free to modify and distribute as needed.

## 🙏 Acknowledgments

- React team for the amazing framework
- Tailwind CSS for the utility-first approach
- Recharts for beautiful charts
- Lucide for clean icons
- The hydroponic community for inspiration

---

**Happy Growing! 🌱**

*Built with ❤️ for the hydroponic community*
